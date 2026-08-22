import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../src/content/loader.js";
import { verificationStats } from "../src/content/verificationStats.js";
import { isCommandPage } from "../src/content/loader.js";
import { PROSE_CATEGORIES } from "../src/content/schema.js";
import { CONTENT_DIR, FIXTURE_DIR, fixtureScript } from "../src/paths.js";

/* Each page now states what `npm run replay -- <slug>` will check on it, and /about/ states the
 * totals. They are the same numbers seen from two distances, so the only interesting failure is
 * the two disagreeing: a page advertising 51 outputs beside a command that prints 49.
 *
 * `src/content/pageChecks.ts` is what stops that: the page, the totals and the harness all
 * partition through it. These assertions are the proof that they still do. */

const model = await loadContent(CONTENT_DIR, FIXTURE_DIR);
const stats = verificationStats(model.pages, CONTENT_DIR, FIXTURE_DIR);

const replayable = model.pages.filter((page) => existsSync(fixtureScript(page.slug, FIXTURE_DIR)));
const commands = replayable.filter(isCommandPage);
const prose = replayable.filter((page) => (PROSE_CATEGORIES as readonly string[]).includes(page.category));

const sum = (pages: typeof model.pages, pick: (page: (typeof model.pages)[number]) => number): number =>
  pages.reduce((total, page) => total + pick(page), 0);

describe("per-page figures and the site totals", () => {
  it("agree on how many command-page outputs are replayed", () => {
    expect(sum(commands, (page) => page.checks.checked)).toBe(stats.outputs - stats.exemptions);
  });

  it("agree on how many are exempt", () => {
    expect(sum(commands, (page) => page.checks.exempt)).toBe(stats.exemptions);
  });

  it("agree on the fixture blocks", () => {
    expect(sum(commands, (page) => page.checks.fixtures)).toBe(stats.fixtures);
  });

  it("agree on the prose outputs", () => {
    expect(sum(prose, (page) => page.checks.checked)).toBe(stats.proseOutputs);
  });

  it("account for every replayed output between them", () => {
    expect(sum(replayable, (page) => page.checks.checked)).toBe(stats.replayed);
  });
});

describe("the shapes a page's figures can take", () => {
  /* Each of these is exercised by real content today. They are asserted so that the branch in
   * `checksSentence` covering it stays reachable, since a wording change tested only against the
   * common case is how the other three end up wrong. */

  it("includes a page compared partly by shape", () => {
    expect(model.pages.filter((page) => page.checks.byShape > 0).length).toBeGreaterThan(0);
  });

  it("includes a page with exemptions alongside checked output", () => {
    expect(
      model.pages.filter((page) => page.checks.exempt > 0 && page.checks.checked > 0).length,
    ).toBeGreaterThan(0);
  });

  it("includes a page that checks nothing because every block is exempt", () => {
    // The state `verificationStats` deliberately leaves out of both its page counters: it opted
    // into the replay, the replay runs it, and it contributes no automated output. Before the
    // per-page figures existed, nothing on the site said so about any particular page.
    expect(
      model.pages.filter((page) => page.checks.checked === 0 && page.checks.exempt > 0).length,
    ).toBeGreaterThan(0);
  });

  it("never reports more by shape than it checks, or a negative count", () => {
    for (const page of model.pages) {
      expect(page.checks.byShape).toBeLessThanOrEqual(page.checks.checked);
      expect(page.checks.checked).toBeGreaterThanOrEqual(0);
      expect(page.checks.exempt).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("by-shape and volatile", () => {
  it("are different figures", () => {
    // `volatile:` says what will differ for a reader; `compare: "shape"` is the only thing that
    // relaxes the comparison, and most volatile output is still compared exactly against an
    // anchored mask. Counting volatile as by-shape would overstate how loosely pages are
    // checked, and the two are close enough in meaning to be conflated by someone tidying up.
    expect(stats.volatile).toBeGreaterThan(sum(commands, (page) => page.checks.byShape));
  });
});
