// What `scripts/merge-timings.ts` decides, with the filesystem and the exit codes left to it.
//
// Separated because that script runs in one place only: a workflow, on main, holding a token that
// can write to the repository. Exercising it meant pushing. Everything here is a pure function of
// the parts, the page set and the file being replaced, so the cases that matter (a hole, an
// overlap, drift too small to commit) are `test/mergeTimings.test.ts` rather than a push and a
// wait.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** How much a page's time has to move before rewriting the file earns its commit.
 *
 *  Whichever bar is higher for the page in hand, which is not the same as "both bars" even though
 *  requiring both is how it is written. Only one of the two is ever the binding one, and which it
 *  is depends on the page:
 *
 *  - Two seconds is two seconds of a shard's load wherever the page lands, so the absolute bar is
 *    the floor everywhere. Below `MOVED_SECONDS / MOVED_FRACTION` seconds it is also the only bar
 *    there is, because a fifth of a page that size is a fraction of a second and anything that
 *    cleared two seconds cleared that long ago.
 *  - Above it the fraction takes over, and stops a couple of seconds on a minute-long page reading
 *    as drift when it is a slow container start.
 *
 *  Worth spelling out because more than half the pages here are under two seconds, so for most of
 *  this site the fraction is doing nothing and the two-second bar is the whole filter. Reading
 *  this as two independent tests, both of which a page must survive, overestimates how much gets
 *  through it. ADR-0023 carries what that means for how often the recorder commits. */
export const MOVED_FRACTION = 0.2;
export const MOVED_SECONDS = 2;

/** Whether a page's recorded time has drifted far enough to be worth rewriting the file for.
 *
 *  A page appearing or disappearing is always material, whatever this says. That is the case the
 *  whole arrangement exists for: a new page is the reason the file goes stale, and it starts out
 *  charged the untimed fallback rather than its real cost. */
export function hasMoved(before: number, after: number): boolean {
  return Math.abs(after - before) >= Math.max(MOVED_SECONDS, before * MOVED_FRACTION);
}

/** What the merge concluded. A closed set rather than a boolean and some fields, so that the
 *  script cannot report one outcome and exit with another's status. */
export const MERGE = {
  incomplete: "incomplete",
  overlapping: "overlapping",
  unbalanced: "unbalanced",
  unchanged: "unchanged",
  write: "write",
} as const;
export type MergeKind = (typeof MERGE)[keyof typeof MERGE];

export interface MergeInput {
  /** Every page a full run replays, by `category/slug`. */
  expected: string[];
  /** The parts, already read and combined. */
  merged: Record<string, number>;
  /** Pages that appeared in more than one part. */
  overlapping: string[];
  /** What `scripts/replay-timings.json` holds now. */
  current: Record<string, number>;
  /** The shard count a candidate file would justify, and the one CI is configured to run. Passed
   *  in rather than read here, so that this module stays a function of its arguments and the test
   *  can put the two out of step without editing a workflow. */
  shardCountFor: (timings: Record<string, number>) => number;
  configuredShards: number;
}

export type MergeResult =
  | { kind: typeof MERGE.incomplete; missing: string[]; covered: number; expected: number }
  | { kind: typeof MERGE.overlapping; pages: string[] }
  | { kind: typeof MERGE.unbalanced; wants: number; configured: number }
  | { kind: typeof MERGE.unchanged; surplus: string[]; expected: number }
  | {
      kind: typeof MERGE.write;
      next: Record<string, number>;
      added: string[];
      removed: string[];
      moved: string[];
      surplus: string[];
    };

/** Every `.json` under a directory, however the artifacts were laid out inside it.
 *
 *  `actions/download-artifact` nests one directory per artifact when it takes a pattern and
 *  flattens them when it does not, and which of those happens is not worth depending on. */
export function partFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return partFiles(path);
    return path.endsWith(".json") ? [path] : [];
  });
}

/** Combines the parts, and says which pages arrived in more than one.
 *
 *  A part that will not parse, or that holds something other than an object, is skipped rather
 *  than thrown on. Every page it should have carried then reports as a hole, which is the outcome
 *  that stops the write and names what is missing; a throw here would have been a stack trace
 *  naming a file in a temporary directory instead. Non-numeric and negative entries are dropped
 *  for the reason `readTimings` drops them: a negative cost pulls a shard's load down and collects
 *  pages there. */
export function combineParts(files: string[]): { merged: Record<string, number>; overlapping: string[] } {
  const merged: Record<string, number> = {};
  const overlapping: string[] = [];
  for (const file of files) {
    let contents: unknown;
    try {
      contents = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      continue;
    }
    if (typeof contents !== "object" || contents === null || Array.isArray(contents)) continue;
    for (const [page, seconds] of Object.entries(contents)) {
      if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) continue;
      // Shards partition the site, so a page in two parts means the run those parts came from was
      // not one run: two workflow attempts whose artifacts were downloaded together, or a matrix
      // that changed size mid-flight. Merging them would silently keep whichever was read last.
      if (merged[page] !== undefined) overlapping.push(page);
      merged[page] = seconds;
    }
  }
  return { merged, overlapping };
}

/** The whole decision, in the order the reasons rule each other out. */
export function mergeTimings(input: MergeInput): MergeResult {
  const { expected, merged, current, shardCountFor, configuredShards } = input;

  if (input.overlapping.length) {
    return { kind: MERGE.overlapping, pages: [...new Set(input.overlapping)].sort() };
  }

  const missing = expected.filter((page) => merged[page] === undefined);
  if (missing.length) {
    return {
      kind: MERGE.incomplete,
      missing,
      covered: expected.length - missing.length,
      expected: expected.length,
    };
  }

  // A page recorded but no longer replayable is not a hole and is not an error: it is a page whose
  // setup script was deleted, or one renamed, in a commit after the run started. Dropping it is
  // the same tidying a serial recording does by writing only what it ran.
  const surplus = Object.keys(merged)
    .filter((page) => !expected.includes(page))
    .sort();
  const next = Object.fromEntries(expected.map((page) => [page, merged[page]!]));

  const added = expected.filter((page) => current[page] === undefined);
  const removed = Object.keys(current)
    .filter((page) => next[page] === undefined)
    .sort();
  const moved = expected.filter((page) => {
    const before = current[page];
    return before !== undefined && hasMoved(before, next[page]!);
  });

  if (added.length === 0 && removed.length === 0 && moved.length === 0) {
    return { kind: MERGE.unchanged, surplus, expected: expected.length };
  }

  // The figures and the shard count are one decision, and this writer can only change half of it.
  // `test/replayShard.test.ts` holds the count in `ci.yml` to what the recorded times justify, and
  // the commit this write becomes runs no CI, so a recording that moved the curve would leave the
  // next contributor's `npm run check` red for a change that was not theirs, on a commit no run
  // ever went near. Refusing leaves figures that are merely stale, which costs wall clock and
  // nothing else, and says which number a human has to change first.
  const wants = shardCountFor(next);
  if (wants !== configuredShards) {
    return { kind: MERGE.unbalanced, wants, configured: configuredShards };
  }

  return { kind: MERGE.write, next, added, removed, moved, surplus };
}
