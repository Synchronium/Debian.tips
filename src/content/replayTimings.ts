// Reading the recorded per-page replay times.
//
// Pure and non-fatal, so the build (which shows a reader how long re-running a page will take)
// and the shard partition (which balances CI with it) share one answer to "what does
// scripts/replay-timings.json actually say". The same arrangement `replaySkips.ts` has, and for
// the same reason: two readers of one file is how two readers disagree.
//
// Advisory on both sides. Absent or unreadable is not an error: a run that cannot read it still
// replays every page, just in a worse-balanced order, and a page with no recorded time simply
// does not tell the reader how long it takes. Never let it become something a result depends on.
import { readFileSync } from "node:fs";
import { REPLAY_TIMINGS_FILE } from "../paths.js";

/** Seconds per page from the last recorded full run, keyed `category/slug` as
 *  `test/verification-baseline.json` is. Negative and non-numeric entries are dropped rather than
 *  trusted: the file is machine-written but hand-editable, and a negative cost would pull a
 *  shard's load below zero and collect pages there. */
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

/** The same figures, read once. The build asks per page and there are dozens of them, so the
 *  uncached version re-read and re-parsed the file once for each. Not reset between builds: the
 *  dev server does not watch this file, and a stale figure costs a reader an inaccurate estimate
 *  rather than a wrong page. */
let cached: Record<string, number> | undefined;
export function replayTimings(): Record<string, number> {
  cached ??= readTimings();
  return cached;
}
