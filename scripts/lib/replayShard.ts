// Splits the pages of a replay across several runs, so CI can put each part on its own runner.
//
// Two properties matter, and only one of them is about speed.
//
// **Every page lands in exactly one shard.** A page in no shard is a page that goes unchecked
// while the run it belongs to reports success, which is the one failure this harness cannot
// tolerate. `test/replayShard.test.ts` asserts the partition over many page counts and shard
// counts rather than trusting the arithmetic here to be obviously right.
//
// **The split is balanced, because a handful of pages decide the answer.** Replay time is
// concentrated: measured 2026-08-26, the four heaviest pages are half of a 427-second run and the
// median page is 1.4 seconds. So the wall clock of a sharded run is the slowest shard, the
// slowest shard can never be quicker than the slowest page, and the only thing worth optimising
// is keeping those few pages apart. Splitting the sorted list round-robin instead does that only
// by accident, and on the same timings it came out 47% slower across seven shards. The gap widens
// as shards are added, because there are fewer pages left to absorb a badly placed heavy one.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { readTimings } from "../../src/content/replayTimings.js";
import { CI_WORKFLOW_FILE } from "../../src/paths.js";
import { pageId } from "./replayPages.js";

// Re-exported so the replay and its tests keep asking this module for everything about sharding,
// while the file itself has one reader. The build needs the same figures, to tell a reader how
// long re-running a page takes, and `src/` cannot import from `scripts/`.
export { readTimings };

/** The recorded timings, projected onto the bare page names a run shards.
 *
 *  The file is keyed `category/slug` and a run names its pages by slug, so something has to
 *  translate between them. Here, once. Three call sites need it, and each would otherwise pick
 *  its own convention. `pageId` explains which key belongs where.
 *
 *  A page with no recorded time is left out, never given a zero. `shardPages` then sees an
 *  absence and charges `UNTIMED_SECONDS`; a zero would make a new page look like the quickest on
 *  the site and collect the rest of them on its shard. */
export function shardCosts(names: string[], timings = readTimings()): Record<string, number> {
  return Object.fromEntries(
    names.flatMap((name) => {
      const seconds = timings[pageId(name)];
      return seconds === undefined ? [] : [[name, seconds] as const];
    }),
  );
}

/** What a shard argument parses to. `index` is 1-based, matching how `--shard=2/4` reads and how
 *  a CI matrix numbers its jobs. */
export interface Shard {
  index: number;
  total: number;
}

export class ShardError extends Error {}

/** Parses `--shard=<index>/<total>`.
 *
 *  Rejects rather than clamps. A typo that silently replayed a different subset than intended
 *  would report a green run over pages nobody chose. */
export function parseShard(value: string): Shard {
  const match = /^(\d+)\/(\d+)$/.exec(value);
  if (!match) throw new ShardError(`--shard takes <index>/<total>, for example 2/4, not "${value}"`);
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (total < 1) throw new ShardError("--shard needs at least one shard");
  if (index < 1 || index > total) {
    throw new ShardError(`--shard=${value} is out of range: index must be between 1 and ${total}`);
  }
  return { index, total };
}

/** What a page with no recorded time is assumed to cost, in seconds.
 *
 *  Several times the median, because an untimed page is a recently added one and those have run
 *  well above the median rather than at it. Charging one the median instead puts it last in the
 *  longest-first ordering, where a page that turns out to be heavy lands on a shard already full.
 *
 *  Not higher than this, though the temptation is there. Simulated against the recorded corpus,
 *  raising it further only helps while the guess about new pages holds, and costs more than it
 *  saves when it does not: over-charging an unknown displaces genuinely heavy pages in the
 *  ordering, and most pages on this site are quick. The real answer to a stale file is the
 *  recording that follows the next green push, and this constant limits the damage until it
 *  lands. It errs in the safe direction: a new page here has cost a second or two. */
export const UNTIMED_SECONDS = 10;

/** Assigns pages to shards longest-first, each to whichever shard is lightest so far.
 *
 *  Greedy longest-processing-time. It is not optimal in general and does not need to be: the
 *  bound that matters is the slowest single page, and putting the heavy pages first is what
 *  reaches it. On this site it does reach it, with the slowest shard costing what the heaviest
 *  page costs on its own, so no packing beats it. `npm run shards` prints that curve from the
 *  recorded times; a figure written out here would be one more that nobody re-measures.
 *
 *  Deterministic for a given page set: pages are ordered by time and then by name, and ties
 *  between equally-loaded shards go to the lowest index. Two runs of the same commit therefore
 *  replay the same pages, which is what makes a failure reproducible from the log. */
export function shardPages(names: string[], shard: Shard, timings: Record<string, number>): string[] {
  if (shard.total === 1) return [...names].sort();

  const cost = (name: string): number => timings[name] ?? UNTIMED_SECONDS;
  const ordered = [...names].sort((a, b) => cost(b) - cost(a) || a.localeCompare(b));

  const load = Array.from({ length: shard.total }, () => 0);
  const assigned: string[][] = Array.from({ length: shard.total }, () => []);
  for (const name of ordered) {
    let lightest = 0;
    for (let i = 1; i < load.length; i++) {
      if (load[i]! < load[lightest]!) lightest = i;
    }
    assigned[lightest]!.push(name);
    load[lightest]! += cost(name);
  }
  return assigned[shard.index - 1]!.sort();
}

/** How long a run of `total` shards takes: the slowest shard, since they run in parallel and the
 *  job is not done until the last one is.
 *
 *  Partitioned by the real `shardPages`, so this is the split CI will get rather than an idealised
 *  one. Here rather than in the test that reads it because `scripts/merge-timings.ts` asks the
 *  same question of a candidate file before writing it, and two implementations of this curve
 *  would let CI be held to one answer and the recorder write figures that assume another. */
export function slowestShardSeconds(names: string[], timings: Record<string, number>, total: number): number {
  const cost = (name: string): number => timings[name] ?? UNTIMED_SECONDS;
  return Math.max(
    ...Array.from({ length: total }, (_, i) =>
      shardPages(names, { index: i + 1, total }, timings).reduce((sum, n) => sum + cost(n), 0),
    ),
  );
}

/** What a runner has to buy to be worth adding, as a fraction of the slowest shard without it.
 *
 *  A floor exists that no count can beat, because a page is never split across shards: the slowest
 *  shard can never be quicker than the slowest page. Approaching it costs a runner per few
 *  seconds, and this is where that stops being worth a machine. */
export const WORTH_A_RUNNER = 0.05;

/** The number of shards these timings justify: the fewest at which another runner would not pay.
 *
 *  Deploy waits on the replay (ADR-0003), so the slowest shard is time between a push and the site
 *  being live rather than a number in a log, which is what makes the runners worth spending at
 *  all. The count is bounded by the page count, since a shard per page is the most that can help.
 *
 *  This is what `.github/workflows/ci.yml` is held to, and it moves as pages are added. That is
 *  the reason the workflow states its count and no measurements: the curve is here, computed from
 *  the recorded file, rather than written out beside the matrix where nothing checks it. */
export function justifiedShardCount(names: string[], timings: Record<string, number>): number {
  for (let total = 1; total < names.length; total++) {
    const now = slowestShardSeconds(names, timings, total);
    if (slowestShardSeconds(names, timings, total + 1) > now * (1 - WORTH_A_RUNNER)) return total;
  }
  return Math.max(names.length, 1);
}

/** How much longer than the best available split a run may take before the count should change.
 *  A low bar. This is wall clock, and deploy waits on it. */
const WASTED_WAIT = 0.05;

/** How many runners past the justified count may sit there earning nothing before that is
 *  reported. A high bar. Nothing waits on them.
 *
 *  The heaviest page sets the floor, so it decides the count, and its replay time varies from one
 *  run to the next. Set this narrower than that variation and every recording asks for the matrix
 *  to be changed back to what the recording before it asked for. */
const SPARE_RUNNERS = 2;

export const SHARD_COUNT = { ok: "ok", tooFew: "too-few", tooMany: "too-many" } as const;
export type ShardCountVerdict = (typeof SHARD_COUNT)[keyof typeof SHARD_COUNT];

/** Whether a configured shard count still suits these timings. Each direction is judged on its own
 *  terms, since the two mistakes cost different things.
 *
 *  **Too few costs wall clock.** Deploy waits on the slowest shard (ADR-0003), and the cost falls
 *  on every push.
 *
 *  **Too many costs runner-minutes.** Nothing waits on those. An extra shard takes a share of the
 *  pages and finishes early; a run is never slower for having one.
 *
 *  A runner that has stopped earning is therefore not doing harm. One threshold for both
 *  directions reports it as though it were, and past the floor that describes every runner: no
 *  count beats the slowest single page, so beyond a certain number they all take the same time.
 *  Whether that number has been reached depends on the heaviest page, which varies. */
export function shardCountVerdict(
  names: string[],
  timings: Record<string, number>,
  configured: number,
): { kind: ShardCountVerdict; wants: number } {
  const wants = justifiedShardCount(names, timings);
  const best = slowestShardSeconds(names, timings, wants);
  if (slowestShardSeconds(names, timings, configured) > best * (1 + WASTED_WAIT)) {
    return { kind: SHARD_COUNT.tooFew, wants };
  }
  if (configured > wants + SPARE_RUNNERS) return { kind: SHARD_COUNT.tooMany, wants };
  return { kind: SHARD_COUNT.ok, wants };
}

/** The shard count `.github/workflows/ci.yml` is configured to run.
 *
 *  Read from the workflow rather than repeated anywhere, because the matrix is the only place the
 *  count is written: the workflow's own expressions read it back as `strategy.job-total`. A second
 *  copy would let the two disagree, and whatever compared against the copy would then be approving
 *  a number CI does not use. */
export function configuredShardCount(file: string = CI_WORKFLOW_FILE): number {
  const workflow: unknown = parse(readFileSync(file, "utf-8"));
  const shards = (workflow as { jobs?: Record<string, { strategy?: { matrix?: { shard?: unknown } } }> })
    .jobs?.["replay"]?.strategy?.matrix?.shard;
  if (!Array.isArray(shards) || shards.length === 0) {
    throw new Error(`no replay shard matrix in ${file}`);
  }
  return shards.length;
}
