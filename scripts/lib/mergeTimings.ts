// What `scripts/merge-timings.ts` decides, with the filesystem and the exit codes left to it.
//
// Separated because that script runs in one place only: a workflow, on main, holding a token that
// can write to the repository. Exercising it meant pushing. Everything here is a pure function of
// the parts, the page set and the file being replaced, so the cases that matter (a hole, an
// overlap, drift too small to commit) are `test/mergeTimings.test.ts` rather than a push and a
// wait.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { UNTIMED_SECONDS } from "./replayShard.js";

/** The bar a page's time has to clear before rewriting the file earns its commit.
 *
 *  Three regimes, because the pages here differ in cost by more than an order of magnitude and no
 *  single measure suits them all. A multiple of the page while the page is small. A flat tolerance
 *  through the middle, where most of the site sits. A fraction again at the top, among the few
 *  pages heavy enough to decide the shard count.
 *
 *  **`MOVED_SECONDS` is the flat middle**, and it is `UNTIMED_SECONDS`: the cost the balancer
 *  charges a page it knows nothing about. Drift smaller than that sits inside an error the
 *  partition already absorbs. Recording it buys nothing and costs a commit. The two constants are
 *  tied, not merely equal: raise what the balancer tolerates and this rises with it.
 *
 *  **`MOVED_FRACTION` governs the heavy pages.** Those wait on a network, and vary by tens of
 *  seconds between runs of identical content, where a flat bar would report noise as news. It
 *  stays well under the swing that has actually moved the shard count. Above that it would filter
 *  out the one measurement most worth keeping.
 *
 *  **`MOVED_MULTIPLE` governs the quickest**, and removes a dead end. A page costing most of a
 *  minute is noticed after moving a fifth; a page costing a second would have to grow tenfold to
 *  reach the flat bar, and nothing justifies that difference. These pages wait on a container
 *  starting instead of on a network, so they move with how loaded the runner is. Growing by half
 *  again as much as itself and shrinking back on the next run is ordinary here. Quadrupling is
 *  not.
 *
 *  ADR-0023 carries what the three mean for how often the recorder commits. */
export const MOVED_FRACTION = 0.2;
export const MOVED_SECONDS = UNTIMED_SECONDS;
export const MOVED_MULTIPLE = 3;

/** Whether a page's recorded time has drifted far enough to be worth rewriting the file for.
 *
 *  A page appearing or disappearing is always material, whatever this says. That is the case the
 *  whole arrangement exists for: a new page is the reason the file goes stale, and it starts out
 *  charged the untimed fallback rather than its real cost. */
export function hasMoved(before: number, after: number): boolean {
  const bar = Math.min(Math.max(MOVED_SECONDS, before * MOVED_FRACTION), before * MOVED_MULTIPLE);
  return Math.abs(after - before) >= bar;
}

/** What the merge concluded. A closed set rather than a boolean and some fields, so that the
 *  script cannot report one outcome and exit with another's status. */
export const MERGE = {
  incomplete: "incomplete",
  overlapping: "overlapping",
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
}

export type MergeResult =
  | { kind: typeof MERGE.incomplete; missing: string[]; covered: number; expected: number }
  | { kind: typeof MERGE.overlapping; pages: string[] }
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
 *  A part that will not parse, or that holds something other than an object, is skipped instead of
 *  thrown on. Every page it should have carried then reports as a hole. That stops the write and
 *  names what is missing, where a throw would have given a stack trace naming a file in a
 *  temporary directory. Non-numeric and negative entries go the way `readTimings` sends them: a
 *  negative cost pulls a shard's load down and collects pages there. */
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

/** The whole decision, in the order the reasons rule each other out.
 *
 *  Only about the figures. Whether the shard count still suits them is `check-shard-count.ts`,
 *  asked after the write rather than before it: the two are one decision, but this writer can
 *  change only the figures, and refusing to record until a human changed the count left
 *  neither able to move. */
export function mergeTimings(input: MergeInput): MergeResult {
  const { expected, merged, current } = input;

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

  return { kind: MERGE.write, next, added, removed, moved, surplus };
}
