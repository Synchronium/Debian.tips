// Reports whether the shard count `.github/workflows/ci.yml` runs still suits the recorded times.
//
//   npm run shards
//
// The count and the figures are one decision held in two files, and only one of them has an
// automatic writer: `.github/workflows/record-timings.yml` rewrites `scripts/replay-timings.json`
// on every push to main, and cannot touch a workflow file, because the token a workflow is given
// may not write one. So the figures move on their own and the count does not, and something has
// to say when they have come apart.
//
// **Not part of `npm run check`, deliberately.** A count that no longer suits the figures costs
// wall clock and nothing else: every page is still replayed, still in a container of its own,
// still compared. Failing the everyday gate over it would stop a contributor's content change for
// a number they did not touch, moved by a bot commit no CI run ever saw. This runs where the
// figures are written instead, on a workflow that gates nothing.
//
// Exit status: 0 when the count fits, 1 when it does not.
import { relative } from "node:path";
import { CI_WORKFLOW_FILE, ROOT } from "../src/paths.js";
import { replayableSlugs } from "./lib/replayPages.js";
import {
  configuredShardCount,
  justifiedShardCount,
  shardCosts,
  slowestShardSeconds,
} from "./lib/replayShard.js";

const slugs = replayableSlugs();
const costs = shardCosts(slugs);
const configured = configuredShardCount();
const wants = justifiedShardCount(slugs, costs);

/** The curve either side of what CI runs, so a reader can see the shape rather than take the
 *  verdict on trust. The slowest single page is printed with it because no count beats it, and a
 *  count sitting on that floor is the usual reason another runner buys nothing. */
function curve(): string {
  const counts = Array.from({ length: Math.max(configured, wants) + 2 }, (_, i) => i + 1);
  const slowest = (n: number): number => Math.round(slowestShardSeconds(slugs, costs, n));
  const floor = Math.round(Math.max(...slugs.map((slug) => costs[slug] ?? 0)));
  return [
    "  shards  " + counts.map((n) => String(n).padStart(5)).join(""),
    "  slowest " + counts.map((n) => String(slowest(n)).padStart(5)).join(""),
    `  the slowest single page is ${floor}s, which no count beats`,
  ].join("\n");
}

if (wants === configured) {
  console.log(`The recorded times justify ${wants} shards, which is what CI runs.`);
  process.exit(0);
}

console.error(`The recorded times justify ${wants} shards, and CI runs ${configured}.`);
console.error(
  wants > configured
    ? "  Another runner would still pay for itself, and deploy waits on the slowest shard."
    : "  A runner is being spent on seconds it no longer buys.",
);
console.error(`  Change the matrix in ${relative(ROOT, CI_WORKFLOW_FILE)} to ${wants}. It is the`);
console.error("  only place the count is written; the workflow reads it back as job-total.");
console.error("");
console.error(curve());
process.exit(1);
