import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { readTimings } from "../scripts/lib/replayShard.js";
import { allPages, hasSetupScript, pageId } from "../scripts/lib/replayPages.js";
import { REPLAY_TIMINGS_FILE, ROOT } from "../src/paths.js";

/* `scripts/replay-timings.json` is what balances the CI shards, and it is the one file here that
 * goes stale silently: nothing needs it to be right, so a run over a site it no longer describes
 * still passes, just slower than it had to be.
 *
 * The cost is real and was measured on the day this test was written. Two pages had been added
 * without re-recording, and replaying that partition against the true times gave a slowest shard
 * of 100 seconds against a plan that claimed 65. Neither the replay nor `npm run check` had
 * anything to say about it.
 *
 * So the file is allowed to drift by a few pages and no further. A budget rather than an exact
 * match, because requiring one would mean a full replay before any new page could ship, and the
 * fallback in `replayShard.ts` already absorbs a page or two.
 *
 * Counted over the pages that *opt into* the replay, never over every page. A page with no setup
 * script is never put in a container and so never has a time to record, and counting it here made
 * the budget exhaustible by pages that could not be recorded: four such pages and this fails
 * permanently, printing a command that cannot clear it. `/about/` publishes the count of pages in
 * exactly that state, so it is a state the site plans for rather than a hypothetical. */

const BUDGET = 3;
const RECORD_COMMAND = "npm run replay -- --record-timings";

describe("the recorded replay timings", () => {
  it("still describe the site, give or take a few pages", () => {
    const timings = readTimings();
    const untimed = allPages()
      .filter(hasSetupScript)
      .filter((page) => timings[pageId(page)] === undefined)
      .sort();

    expect(
      untimed.length > BUDGET ? untimed : [],
      [
        `${relative(ROOT, REPLAY_TIMINGS_FILE)} has no time for ${untimed.length} pages,`,
        `which is more than the ${BUDGET} this allows before the shards go out of balance:`,
        "",
        ...untimed.map((page) => `  ${page}`),
        "",
        `Re-record on a full clean run: ${RECORD_COMMAND}`,
        "It refuses anything less than the whole site, so run it when the replay is green.",
      ].join("\n"),
    ).toEqual([]);
  });

  it("records nothing for a page the replay never runs", () => {
    // The other direction of the same rule. A recorded time for a page with no setup script would
    // mean either that the file was hand-edited or that the run put an opted-out page in a
    // container, and both are worth hearing about.
    //
    // Comparing whole `category/slug` keys rather than slugs, so an entry naming a real page in
    // the wrong category fails here instead of matching a setup script that belongs to another
    // page and being counted as timed.
    const recordable = new Set(allPages().filter(hasSetupScript).map(pageId));
    const optedOut = Object.keys(readTimings()).filter((page) => !recordable.has(page));
    expect(optedOut).toEqual([]);
  });

  it("is read from a file that exists and parses", () => {
    // readTimings swallows both, on purpose: a run that cannot read the file still replays every
    // page. That is right for the replay and wrong here, where an empty result would let the
    // check above pass by finding nothing to compare against.
    expect(Object.keys(readTimings()).length).toBeGreaterThan(0);
  });
});
