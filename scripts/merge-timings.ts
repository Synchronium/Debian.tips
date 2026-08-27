// Merges the per-shard timings a CI replay leaves behind into `scripts/replay-timings.json`.
//
//   npx tsx scripts/merge-timings.ts <directory of parts>
//
// Every shard measures the pages it ran and writes them with `--timings-out`. No shard may write
// the shared file: each holds a fraction of the site, and a partial write would drop every page
// it did not run to the untimed fallback. This is where the fractions become a whole, and where
// the completeness rule that `--record-timings` enforces for a serial run is enforced for a
// sharded one.
//
// Writes nothing unless the result would differ enough to be worth a commit, so a caller can use
// `git diff --quiet` to decide whether there is anything to push rather than reading this output.
//
// Exit status: 0 whether or not it wrote, 1 if the parts do not cover the site, 2 on a bad
// argument. Refusing loudly matters more than it looks: a hole here is invisible afterwards,
// because a missing page and a page that has never been recorded are the same absence in the
// file, and both simply balance worse.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPLAY_TIMINGS_FILE, ROOT } from "../src/paths.js";
import { readTimings } from "../src/content/replayTimings.js";
import { pageId, replayableSlugs } from "./lib/replayPages.js";

/** How much a page's time has to move before rewriting the file earns its commit.
 *
 *  Both bars, not either. Runner timings jitter, and on a site whose median page is under two
 *  seconds a relative bar alone would fire constantly on pages too small to affect any shard's
 *  load; an absolute bar alone would fire on every heavy page for a rounding error. Together they
 *  come to "a page big enough to matter has moved enough to matter", which is the only drift that
 *  changes how a run is balanced.
 *
 *  A page appearing or disappearing is always material, whatever these say. That is the case the
 *  whole arrangement exists for: a new page is the reason the file goes stale, and it starts out
 *  charged the untimed fallback rather than its real cost. */
const MOVED_FRACTION = 0.2;
const MOVED_SECONDS = 2;

const directory = process.argv[2];
if (!directory || !existsSync(directory)) {
  console.error("merge-timings: needs a directory holding the per-shard timing files");
  process.exit(2);
}

/** Every `.json` under the directory, however the artifacts were laid out inside it.
 *
 *  `actions/download-artifact` nests one directory per artifact when it takes a pattern and
 *  flattens them when it does not, and which of those happens is not worth depending on. */
function partFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return partFiles(path);
    return path.endsWith(".json") ? [path] : [];
  });
}

const parts = partFiles(directory);
if (parts.length === 0) {
  console.error(`merge-timings: no .json parts under ${directory}`);
  process.exit(1);
}

const merged: Record<string, number> = {};
const overlapping: string[] = [];
for (const part of parts) {
  const contents: unknown = JSON.parse(readFileSync(part, "utf-8"));
  for (const [page, seconds] of Object.entries(contents as Record<string, unknown>)) {
    if (typeof seconds !== "number" || seconds < 0) continue;
    // Shards partition the site, so a page in two parts means the run those parts came from was
    // not one run: two workflow attempts whose artifacts were downloaded together, or a matrix
    // that changed size mid-flight. Merging them would silently keep whichever was read last.
    if (merged[page] !== undefined) overlapping.push(page);
    merged[page] = seconds;
  }
}

if (overlapping.length) {
  console.error(`merge-timings: ${overlapping.length} page(s) appear in more than one part:`);
  console.error(`  ${[...new Set(overlapping)].sort().join(", ")}`);
  console.error("  Shards are disjoint, so these parts are not one run's worth. Not writing.");
  process.exit(1);
}

const expected = replayableSlugs().map(pageId).sort();
const missing = expected.filter((page) => merged[page] === undefined);
if (missing.length) {
  console.error(
    `merge-timings: the parts cover ${expected.length - missing.length} of ${expected.length} pages.`,
  );
  console.error(`  Missing: ${missing.join(", ")}`);
  console.error(`  ${relative(ROOT, REPLAY_TIMINGS_FILE)} is unchanged.`);
  process.exit(1);
}

// A page recorded but no longer replayable is not a hole and is not an error: it is a page whose
// setup script was deleted, or one renamed, in a commit after the run started. Dropping it is the
// same tidying a serial recording does by writing only what it ran.
const surplus = Object.keys(merged).filter((page) => !expected.includes(page));
const next = Object.fromEntries(expected.map((page) => [page, merged[page]!]));

const current = readTimings();
const added = expected.filter((page) => current[page] === undefined);
const removed = Object.keys(current).filter((page) => next[page] === undefined);
const moved = expected.filter((page) => {
  const before = current[page];
  if (before === undefined) return false;
  const delta = Math.abs(next[page]! - before);
  return delta >= MOVED_SECONDS && delta >= before * MOVED_FRACTION;
});

if (added.length === 0 && removed.length === 0 && moved.length === 0) {
  console.log(
    `No material change across ${expected.length} pages; leaving ${relative(ROOT, REPLAY_TIMINGS_FILE)} alone.`,
  );
  if (surplus.length) console.log(`  (ignored ${surplus.length} recorded page(s) that no longer replay)`);
  process.exit(0);
}

writeFileSync(REPLAY_TIMINGS_FILE, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Wrote ${expected.length} page times to ${relative(ROOT, REPLAY_TIMINGS_FILE)}:`);
if (added.length) console.log(`  newly timed: ${added.join(", ")}`);
if (removed.length) console.log(`  no longer replayed: ${removed.join(", ")}`);
for (const page of moved) {
  console.log(`  ${page}: ${current[page]!}s -> ${next[page]!}s`);
}
