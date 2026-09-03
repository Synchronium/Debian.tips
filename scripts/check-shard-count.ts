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
  SHARD_COUNT,
  UNTIMED_SECONDS,
  configuredShardCount,
  shardCosts,
  shardCountVerdict,
  slowestShardSeconds,
} from "./lib/replayShard.js";

const slugs = replayableSlugs();
const costs = shardCosts(slugs);
const configured = configuredShardCount();
const { kind, wants } = shardCountVerdict(slugs, costs, configured);

/** The curve either side of what CI runs, so a reader can see the shape rather than take the
 *  verdict on trust. The slowest single page is printed with it because no count beats it, and a
 *  count sitting on that floor is the usual reason another runner buys nothing. */
function curve(): string {
  const counts = Array.from({ length: Math.max(configured, wants) + 2 }, (_, i) => i + 1);
  const slowest = (n: number): number => Math.round(slowestShardSeconds(slugs, costs, n));
  // An untimed page is charged what the balancer charges it. Charging it zero here instead would
  // print the slowest *recorded* page as the floor, understated, in exactly the state the fallback
  // exists for.
  const floor = Math.round(Math.max(...slugs.map((slug) => costs[slug] ?? UNTIMED_SECONDS)));
  return [
    "  shards  " + counts.map((n) => String(n).padStart(5)).join(""),
    "  slowest " + counts.map((n) => String(slowest(n)).padStart(5)).join(""),
    `  the slowest single page is ${floor}s, which no count beats`,
  ].join("\n");
}

if (kind === SHARD_COUNT.ok) {
  const spare = configured > wants ? `, and ${configured} costs nothing over ${wants}` : "";
  console.log(`CI runs ${configured} shards; the recorded times justify ${wants}${spare}.`);
  process.exit(0);
}

console.error(`CI runs ${configured} shards, and the recorded times justify ${wants}.`);
console.error(
  kind === SHARD_COUNT.tooFew
    ? `  ${configured} takes ${Math.round(slowestShardSeconds(slugs, costs, configured))}s against ` +
        `${Math.round(slowestShardSeconds(slugs, costs, wants))}s, and deploy waits on that.`
    : "  Those runners are not earning, and have not been for longer than this page set swings.",
);
console.error(`  Change the matrix in ${relative(ROOT, CI_WORKFLOW_FILE)} to ${wants}. It is the`);
console.error("  only place the count is written; the workflow reads it back as job-total.");
console.error("");
console.error(curve());
process.exit(1);
