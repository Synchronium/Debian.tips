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
 *  Both bars, not either. Runner timings jitter, and on a site whose median page is under two
 *  seconds a relative bar alone would fire constantly on pages too small to affect any shard's
 *  load; an absolute bar alone would fire on every heavy page for a rounding error. Together they
 *  come to "a page big enough to matter has moved enough to matter", which is the only drift that
 *  changes how a run is balanced.
 *
 *  A page appearing or disappearing is always material, whatever these say. That is the case the
 *  whole arrangement exists for: a new page is the reason the file goes stale, and it starts out
 *  charged the untimed fallback rather than its real cost. */
export const MOVED_FRACTION = 0.2;
export const MOVED_SECONDS = 2;

/** Whether a page's recorded time has drifted far enough to be worth rewriting the file for. */
export function hasMoved(before: number, after: number): boolean {
  const delta = Math.abs(after - before);
  return delta >= MOVED_SECONDS && delta >= before * MOVED_FRACTION;
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
