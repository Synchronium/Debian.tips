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
import { readTimings } from "../../src/content/replayTimings.js";

// Re-exported so the replay and its tests keep asking this module for everything about sharding,
// while the file itself has one reader. The build needs the same figures, to tell a reader how
// long re-running a page takes, and `src/` cannot import from `scripts/`.
export { readTimings };

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
 *  ordering, and most pages on this site are quick. `test/replayTimings.test.ts` is the real
 *  answer to a stale file, and this constant only limits the damage in the meantime. */
const UNTIMED_SECONDS = 10;

/** Assigns pages to shards longest-first, each to whichever shard is lightest so far.
 *
 *  Greedy longest-processing-time. It is not optimal in general and does not need to be: the
 *  bound that matters is the slowest single page, and putting the heavy pages first is what
 *  reaches it. Measured 2026-08-26 over the real timings, seven shards came out at 62.8 seconds,
 *  which is the `apt` page's own time: the split has reached the floor and no packing beats it.
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
