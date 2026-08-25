// Splits the pages of a replay across several runs, so CI can put each part on its own runner.
//
// Two properties matter, and only one of them is about speed.
//
// **Every page lands in exactly one shard.** A page in no shard is a page that goes unchecked
// while the run it belongs to reports success, which is the one failure this harness cannot
// tolerate. `test/replayShard.test.ts` asserts the partition over many page counts and shard
// counts rather than trusting the arithmetic here to be obviously right.
//
// **The split is balanced, because one page decides the answer.** Replay time is concentrated:
// measured 2026-08-24, the `apt` page alone is a quarter of a 262-second run and the median page
// is 1.09 seconds. So the wall clock of a sharded run is the slowest shard, the slowest shard can
// never be quicker than the slowest page, and the only thing worth optimising is keeping the
// handful of heavy pages apart. Splitting the sorted list round-robin instead does that by
// accident: it put `apt` and `remove-vs-purge-vs-autoremove` in one shard at five shards and gave
// a slower run than four did.
import { readFileSync } from "node:fs";
import { REPLAY_TIMINGS_FILE } from "../../src/paths.js";

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

/** Seconds per page from the last recorded full run, keyed by page name.
 *
 *  Absent or unreadable is not an error: the file is an optimisation, and a run that cannot read
 *  it still replays every page, just in a worse-balanced order. Never let it become load-bearing. */
export function readTimings(file: string = REPLAY_TIMINGS_FILE): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 0,
      ),
    );
  } catch {
    return {};
  }
}

/** What a page with no recorded time is assumed to cost, in seconds.
 *
 *  Above the median rather than at it, so a page nobody has timed yet is spread out rather than
 *  piled onto one shard. A new page is also the one most likely to be slow, since it is the one
 *  being worked on. */
const UNTIMED_SECONDS = 2;

/** Assigns pages to shards longest-first, each to whichever shard is lightest so far.
 *
 *  Greedy longest-processing-time. It is not optimal in general and does not need to be: the
 *  bound that matters is the slowest single page, and putting the heavy pages first is what
 *  reaches it. Measured 2026-08-24 over the real timings, four shards came out at 66 seconds
 *  against a 64.8-second floor.
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
