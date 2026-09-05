import { describe, expect, it } from "vitest";
import { readTimings } from "../scripts/lib/replayShard.js";
import { ambiguousSlugs, pageId, replayableSlugs } from "../scripts/lib/replayPages.js";

/* `scripts/replay-timings.json` balances the CI shards and gives a reader the estimate a page
 * shows before they run it. Both readings are advisory: stale, the shards balance worse; missing,
 * every page still runs.
 *
 * **Nothing here may fail over how old the file is**, and ADR-0023 carries why: a gate inside
 * `check` turns CI's conclusion red, and the recorder that would refresh the file runs only on a
 * green one. Completeness is enforced where acting on it is possible instead, by
 * `scripts/maintain/merge-timings.ts` refusing to write a file that does not cover every page the replay
 * runs. So these assertions are about what the file says, never about when it was written. */

describe("the recorded replay timings", () => {
  it("records nothing for a page the replay never runs", () => {
    // A recorded time for a page with no setup script means either a hand-edited file or a run
    // that put an opted-out page in a container. Whole `category/slug` keys rather than slugs, so
    // an entry naming a real page in the wrong category fails here rather than matching another
    // page's setup script and counting as timed.
    const recordable = new Set(replayableSlugs().map(pageId));
    const optedOut = Object.keys(readTimings()).filter((page) => !recordable.has(page));
    expect(optedOut).toEqual([]);
  });

  it("can name every page the replay runs", () => {
    // Slugs are unique per category rather than site-wide, and a setup script is
    // `scripts/fixtures/<slug>.sh`, so a slug two pages share cannot be keyed: the shard cost, the
    // recorded time and the estimate a reader is shown would all be one page's, applied to two.
    // The partition throws on this several steps from the files that caused it; here they are
    // named, and the remedy is to rename one of the pair or drop the script.
    expect(ambiguousSlugs()).toEqual([]);
  });

  it("is read from a file that exists and parses", () => {
    // readTimings swallows both, so that a run which cannot read the file still replays every
    // page. Right there and wrong here, where an empty result would let the checks above pass by
    // finding nothing to compare against.
    expect(Object.keys(readTimings()).length).toBeGreaterThan(0);
  });
});
