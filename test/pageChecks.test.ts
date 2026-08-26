import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../src/content/loader.js";
import { renderMarkdown } from "../src/content/markdown.js";
import { verificationStats } from "../src/content/verificationStats.js";
import { isCommandPage } from "../src/content/loader.js";
import { PROSE_CATEGORIES } from "../src/content/schema.js";
import { CONTENT_DIR, FIXTURE_DIR, fixtureScript, proseSource } from "../src/paths.js";

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
  it("agree on how many outputs are replayed", () => {
    expect(sum(commands, (page) => page.checks.checked) + sum(prose, (page) => page.checks.checked)).toBe(
      stats.replayed,
    );
  });

  it("agree on how many are exempt", () => {
    // Both kinds, since ADR-0021: a prose page's exemptions are blocks a reader is shown and the
    // site does not re-run, exactly like a command page's, and the sentence at the foot of each
    // page counts them the same way. A total that left the prose ones out would be smaller than
    // the sum of the footers it is meant to be the sum of.
    expect(sum(commands, (page) => page.checks.exempt) + sum(prose, (page) => page.checks.exempt)).toBe(
      stats.exemptions,
    );
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

describe("every block a reader is shown as output", () => {
  it("is counted by the page that shows it", async () => {
    // The property ADR-0021 is about, asserted against the rendered markup rather than against
    // the parser, which would only restate its own arithmetic. A block reaches the reader inside
    // a `<pre aria-label="output">`, and the sentence at the foot of the page accounts for
    // exactly `checked + exempt` of them. An output fence that belongs to neither is the gap
    // this closes: it used to be reported as a count nobody published and required to explain
    // nothing.
    const undercounted: string[] = [];
    for (const page of prose) {
      const { html } = await renderMarkdown(readFileSync(proseSource(page.category, page.slug), "utf-8"));
      const shown = [...html.matchAll(/<pre aria-label="output"/g)].length;
      const counted = page.checks.checked + page.checks.exempt;
      if (shown !== counted) {
        undercounted.push(`${page.category}/${page.slug}: shows ${shown}, counts ${counted}`);
      }
    }
    expect(undercounted).toEqual([]);
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
