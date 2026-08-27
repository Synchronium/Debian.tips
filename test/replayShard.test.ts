import { describe, expect, it } from "vitest";
import {
  ShardError,
  justifiedShardCount,
  parseShard,
  readTimings,
  shardPages,
  slowestShardSeconds,
} from "../scripts/lib/replayShard.js";

/* Sharding trades a property this harness depends on for wall clock: with one run there was
 * nothing to get wrong, and with four there is a partition to get right. A page in no shard goes
 * unchecked while every job reports success, so the first describe below is the one that matters.
 * The rest is balance, which only costs time when it is wrong. */

const PAGES = [
  "apt",
  "apt-essentials",
  "awk",
  "chmod",
  "cowsay",
  "cut",
  "dpkg",
  "grep",
  "ls",
  "packages-kept-back",
  "remove-vs-purge-vs-autoremove",
  "sed",
  "systemctl",
  "tar",
  "wc",
];

const TIMINGS: Record<string, number> = {
  apt: 64.8,
  "remove-vs-purge-vs-autoremove": 47,
  "packages-kept-back": 15.7,
  systemctl: 14.8,
  "apt-essentials": 12.9,
  dpkg: 7.9,
  tar: 6.1,
};

/** Every page, exactly once, across all shards. */
function union(names: string[], total: number, timings: Record<string, number>): string[] {
  const seen: string[] = [];
  for (let index = 1; index <= total; index++) {
    seen.push(...shardPages(names, { index, total }, timings));
  }
  return seen.sort();
}

describe("the shard partition", () => {
  it("covers every page exactly once, at every shard count", () => {
    for (let total = 1; total <= PAGES.length + 3; total++) {
      const seen = union(PAGES, total, TIMINGS);
      expect(seen, `${total} shards dropped or duplicated a page`).toEqual([...PAGES].sort());
    }
  });

  it("covers every page when no timings are recorded at all", () => {
    for (let total = 1; total <= 6; total++) {
      expect(union(PAGES, total, {})).toEqual([...PAGES].sort());
    }
  });

  // The file is written by a full run and read by every later one, so it lags the page set by
  // however long it has been since anyone recorded it. Lagging must cost balance and nothing else.
  it("covers every page when the timings are stale", () => {
    const stale = { ...TIMINGS, "a-page-that-was-deleted": 30 };
    for (let total = 1; total <= 6; total++) {
      expect(union(PAGES, total, stale)).toEqual([...PAGES].sort());
    }
  });

  it("handles fewer pages than shards, and no pages at all", () => {
    expect(union(["ls", "wc"], 5, TIMINGS)).toEqual(["ls", "wc"]);
    expect(union([], 4, TIMINGS)).toEqual([]);
  });

  it("puts everything in the one shard when there is only one", () => {
    expect(shardPages(PAGES, { index: 1, total: 1 }, TIMINGS)).toEqual([...PAGES].sort());
  });

  it("gives the same answer twice for the same page set", () => {
    const once = shardPages(PAGES, { index: 2, total: 4 }, TIMINGS);
    const again = shardPages([...PAGES].reverse(), { index: 2, total: 4 }, TIMINGS);
    expect(again).toEqual(once);
  });
});

describe("balancing the shards", () => {
  it("keeps the two heaviest pages apart", () => {
    // The whole point. Splitting the sorted list round-robin put these together at five shards
    // and produced a slower run than four did.
    const together = [1, 2, 3, 4].some((index) => {
      const pages = shardPages(PAGES, { index, total: 4 }, TIMINGS);
      return pages.includes("apt") && pages.includes("remove-vs-purge-vs-autoremove");
    });
    expect(together).toBe(false);
  });

  it("comes within a page's length of the best possible split", () => {
    const cost = (name: string): number => TIMINGS[name] ?? 2;
    const total = 4;
    const loads = [1, 2, 3, 4].map((index) =>
      shardPages(PAGES, { index, total }, TIMINGS).reduce((sum, name) => sum + cost(name), 0),
    );
    // No split can beat the slowest single page, so that is the bar rather than the mean.
    const floor = Math.max(...PAGES.map(cost));
    expect(Math.max(...loads)).toBeLessThanOrEqual(floor * 1.1);
  });
});

describe("parsing --shard", () => {
  it("accepts an index and a total", () => {
    expect(parseShard("2/4")).toEqual({ index: 2, total: 4 });
    expect(parseShard("1/1")).toEqual({ index: 1, total: 1 });
  });

  // Rejected rather than clamped: a typo that quietly replayed a different subset would report a
  // green run over pages nobody chose.
  it("rejects anything it cannot honour exactly", () => {
    for (const bad of ["0/4", "5/4", "4", "2/0", "-1/4", "2/4/6", "two/four", ""]) {
      expect(() => parseShard(bad), `accepted "${bad}"`).toThrow(ShardError);
    }
  });
});

describe("reading the timings file", () => {
  it("treats a missing or malformed file as no timings rather than an error", () => {
    expect(readTimings("/nonexistent/replay-timings.json")).toEqual({});
    expect(readTimings("/etc/hostname")).toEqual({});
  });
});

/* How many shards CI runs, checked against what the pages actually cost.
 *
 * The number lived in a comment beside the matrix, with the measurements that justified it
 * written out underneath. Both went stale the moment a page was added, and a comment restating
 * data the repository already holds is the kind CLAUDE.md rules out: nothing was checking it, so
 * it drifted for as long as nobody happened to recompute the table by hand.
 *
 * Now the workflow states the count and this states why it is right, which also closes the gap
 * that made automation unsafe. Recording timings from CI ages nothing, because the only figures
 * left are in the file being rewritten.
 *
 * The curve itself is `scripts/lib/replayShard.ts`, not this file. `scripts/merge-timings.ts` asks
 * the same question of a candidate recording before writing it, so that the commit CI makes cannot
 * be the thing that fails this test on somebody else's next push.
 */
/* What the curve says, over page sets written here rather than over the recorded file.
 *
 * Whether the count in `ci.yml` currently suits the recorded times is `npm run shards`, and it is
 * deliberately not a test. That comparison has one moving part nobody here controls: the recorder
 * rewrites `replay-timings.json` on every push to main, and it cannot write a workflow file, so
 * the figures move and the count does not. As a test it would fail on a contributor's machine for
 * a bot commit no CI run ever saw, over a number that costs wall clock and never coverage. As a
 * step in the workflow that writes the figures, it asks the one person who can act for one line.
 *
 * What is worth pinning is the shape of the function, which these do with timings of their own. */
describe("the shard count a set of timings justifies", () => {
  it("adds a runner while one still pays for itself", () => {
    // The direction that costs time rather than money. Four equal pages halve and halve again, so
    // stopping at one shard would be leaving three quarters of the wall clock on the table.
    const even = { a: 20, b: 20, c: 20, d: 20 };
    expect(justifiedShardCount(Object.keys(even), even)).toBeGreaterThan(1);
  });

  it("never asks for more shards than there are pages", () => {
    // A shard per page is the most that can help, and past it every extra runner reports an empty
    // shard and exits 0. The search has to stop somewhere and this is where.
    const two = { a: 5, b: 5 };
    expect(justifiedShardCount(["a", "b"], two)).toBeLessThanOrEqual(2);
  });

  it("stops where the floor is, since no count beats the slowest page", () => {
    // One page dominating is the shape this site has: `apt` alone is most of the slowest shard.
    // Splitting the rest finer cannot help once every other page fits beside it.
    const dominated = { heavy: 60, a: 10, b: 10, c: 10 };
    const names = Object.keys(dominated);
    const wants = justifiedShardCount(names, dominated);
    expect(slowestShardSeconds(names, dominated, wants)).toBe(60);
  });
});
