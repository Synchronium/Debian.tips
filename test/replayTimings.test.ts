import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { readTimings } from "../scripts/lib/replayShard.js";
import { ambiguousSlugs, pageId, replayableSlugs } from "../scripts/lib/replayPages.js";
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
 * match, because the only writer is the workflow ADR-0023 put on main: a branch cannot record,
 * so an exact match would fail every branch that adds a page and could be cleared only by
 * merging it.
 *
 * The budget is therefore sized as pages-per-push rather than as tolerance for forgetting. A
 * batch of new pages reaches main in one push and is timed by the next one, and until then each
 * of them is charged `UNTIMED_SECONDS`. That error runs in the safe direction: a new page here
 * has cost a second or two against a fallback of ten, so the partition holds back rather than
 * overruns. The dangerous direction is a page that was recorded and has since grown, which this
 * test cannot see and `hasMoved` in `mergeTimings.ts` exists to catch.
 *
 * Counted over the pages that *opt into* the replay, never over every page. A page with no setup
 * script is never put in a container and so never has a time to record, and counting it here made
 * the budget exhaustible by pages that could not be recorded: enough such pages and this fails
 * permanently, printing a remedy that cannot clear it. `/about/` publishes the count of pages in
 * exactly that state, so it is a state the site plans for rather than a hypothetical. */

const BUDGET = 8;

describe("the recorded replay timings", () => {
  it("still describe the site, give or take a few pages", () => {
    const timings = readTimings();
    const untimed = replayableSlugs()
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
        "Nothing local records these: a push to main replays every page and the recorder commits",
        "the result, so the fix is to land what is already written rather than to measure it here.",
        "More than a batch of pages listed above means that recorder has stopped running.",
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
    const recordable = new Set(replayableSlugs().map(pageId));
    const optedOut = Object.keys(readTimings()).filter((page) => !recordable.has(page));
    expect(optedOut).toEqual([]);
  });

  it("can name every page the replay runs", () => {
    // Both checks above key by `category/slug`, and a slug two pages share cannot be turned into
    // one. Slugs are unique per category rather than site-wide, and a setup script is
    // `scripts/fixtures/<slug>.sh`, so a shared slug with a script attached belongs to a page
    // nothing can identify: the cost that balances a shard, the time recorded against it and the
    // estimate the page shows a reader would all be one page's, applied to two.
    //
    // Left to itself this surfaces as an "is ambiguous" throw from inside the shard partition,
    // several steps from the two files that caused it. Here it names them, and the remedy is to
    // rename one page of the pair or drop the script.
    expect(ambiguousSlugs()).toEqual([]);
  });

  it("is read from a file that exists and parses", () => {
    // readTimings swallows both, on purpose: a run that cannot read the file still replays every
    // page. That is right for the replay and wrong here, where an empty result would let the
    // check above pass by finding nothing to compare against.
    expect(Object.keys(readTimings()).length).toBeGreaterThan(0);
  });
});
