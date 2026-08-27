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
// The decisions are `scripts/lib/mergeTimings.ts`, tested there. What is here is the directory,
// the file and the exit status: 0 whether or not it wrote, 1 if the parts do not describe one
// whole run, 2 on a bad argument. Refusing loudly matters more than it looks, because a hole is
// invisible afterwards: a missing page and a page that has never been recorded are the same
// absence in the file, and both simply balance worse. `.github/workflows/record-timings.yml` gates
// nothing, so refusing costs a red mark and no build.
import { existsSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { REPLAY_TIMINGS_FILE, ROOT } from "../src/paths.js";
import { readTimings } from "../src/content/replayTimings.js";
import { MERGE, combineParts, mergeTimings, partFiles } from "./lib/mergeTimings.js";
import { pageId, replayableSlugs } from "./lib/replayPages.js";

const directory = process.argv[2];
if (!directory || !existsSync(directory)) {
  console.error("merge-timings: needs a directory holding the per-shard timing files");
  process.exit(2);
}

const files = partFiles(directory);
if (files.length === 0) {
  console.error(`merge-timings: no .json parts under ${directory}`);
  process.exit(1);
}

const here = relative(ROOT, REPLAY_TIMINGS_FILE);
// Read before the write below, since that replaces the file this is read from, and the report
// names both figures for every page that moved.
const current = readTimings();
const { merged, overlapping } = combineParts(files);
const result = mergeTimings({
  expected: replayableSlugs().map(pageId).sort(),
  merged,
  overlapping,
  current,
});

if (result.kind === MERGE.overlapping) {
  console.error(`merge-timings: ${result.pages.length} page(s) appear in more than one part:`);
  console.error(`  ${result.pages.join(", ")}`);
  console.error("  Shards are disjoint, so these parts are not one run's worth. Not writing.");
  process.exit(1);
} else if (result.kind === MERGE.incomplete) {
  console.error(`merge-timings: the parts cover ${result.covered} of ${result.expected} pages.`);
  console.error(`  Missing: ${result.missing.join(", ")}`);
  console.error(`  ${here} is unchanged.`);
  process.exit(1);
} else if (result.kind === MERGE.unchanged) {
  console.log(`No material change across ${result.expected} pages; leaving ${here} alone.`);
  if (result.surplus.length) {
    console.log(`  (ignored ${result.surplus.length} recorded page(s) that no longer replay)`);
  }
} else {
  writeFileSync(REPLAY_TIMINGS_FILE, `${JSON.stringify(result.next, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(result.next).length} page times to ${here}:`);
  if (result.added.length) console.log(`  newly timed: ${result.added.join(", ")}`);
  if (result.removed.length) console.log(`  no longer replayed: ${result.removed.join(", ")}`);
  for (const page of result.moved) {
    console.log(`  ${page}: ${current[page]!}s -> ${result.next[page]!}s`);
  }
}
