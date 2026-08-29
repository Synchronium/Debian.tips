import { describe, expect, it } from "vitest";
import { readTimings } from "../scripts/lib/replayShard.js";
import { ambiguousSlugs, pageId, replayableSlugs } from "../scripts/lib/replayPages.js";

/* `scripts/replay-timings.json` balances the CI shards and gives a reader the estimate a page
 * shows before they run it. Both readings are advisory: stale, the shards balance worse; missing,
 * every page still runs.
 *
 * **Nothing here counts how many pages have no time yet.** That check lived in this file until
 * 2026-08-29, and it could not clear itself. It ran inside `check`, so failing it made CI's
 * conclusion a failure, and `record-timings.yml` records only when that conclusion is a success.
 * A push adding more pages than the cap allowed therefore failed the build, skipped the recording
 * that was the cap's own stated remedy, and failed again on the next push with one more page to
 * explain. It also skipped the deploy, so the site stopped at the last green commit.
 *
 * Completeness is enforced where acting on it is possible instead: `scripts/merge-timings.ts`
 * refuses to write a file that does not cover every page the replay runs. A recording that lands
 * is therefore complete by construction, and one that cannot be leaves the previous figures alone
 * and goes red on a workflow that gates nothing. ADR-0023 carries why nothing about these figures
 * may fail a build.
 *
 * What is left here is about what the file says rather than how old it is, and neither assertion
 * depends on when the recorder last ran. */

describe("the recorded replay timings", () => {
  it("records nothing for a page the replay never runs", () => {
    // A recorded time for a page with no setup script would mean either that the file was
    // hand-edited or that the run put an opted-out page in a container, and both are worth
    // hearing about.
    //
    // Comparing whole `category/slug` keys rather than slugs, so an entry naming a real page in
    // the wrong category fails here instead of matching a setup script that belongs to another
    // page and being counted as timed.
    const recordable = new Set(replayableSlugs().map(pageId));
    const optedOut = Object.keys(readTimings()).filter((page) => !recordable.has(page));
    expect(optedOut).toEqual([]);
  });

  it("can name every page the replay runs", () => {
    // Both the check above and the shard partition key by `category/slug`, and a slug two pages
    // share cannot be turned into one. Slugs are unique per category rather than site-wide, and a
    // setup script is `scripts/fixtures/<slug>.sh`, so a shared slug with a script attached
    // belongs to a page nothing can identify: the cost that balances a shard, the time recorded
    // against it and the estimate the page shows a reader would all be one page's, applied to two.
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
