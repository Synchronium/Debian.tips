import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIGURE,
  FIGURES,
  type FigureName,
  type PageVerification,
  UPDATE_COMMAND,
  type VerificationBaseline,
  figureValue,
  isRegression,
  verificationBaseline,
} from "../scripts/lib/verificationBaseline.js";
import { ROOT, VERIFICATION_BASELINE_FILE } from "../src/paths.js";

/* Editing a page is the one routine change here that can weaken verification while every gate
 * stays green: separate a command fence from its output fence by a single line and the example
 * stops being checked, which the replay reports as "not checkable" and treats as fine.
 *
 * So the counts are pinned. Any movement fails, in either direction: a snapshot that only
 * noticed losses would drift upwards as pages were added and stop describing the site, and then
 * a later loss back to the recorded number would pass. */

const BASELINE_FILE = relative(ROOT, VERIFICATION_BASELINE_FILE);

const recorded = JSON.parse(readFileSync(VERIFICATION_BASELINE_FILE, "utf-8")) as VerificationBaseline;
const current = await verificationBaseline();

const FIGURE_NAMES = Object.values(FIGURE);

interface Move {
  figure: FigureName;
  before: number;
  after: number;
}

function movesOn(before: PageVerification, after: PageVerification): Move[] {
  return FIGURE_NAMES.map((figure) => ({
    figure,
    before: figureValue(before, figure),
    after: figureValue(after, figure),
  })).filter((move) => move.before !== move.after);
}

function describeMove(page: string, move: Move): string {
  const direction = isRegression(move.figure, move.before, move.after)
    ? `REGRESSION: ${FIGURES[move.figure].regression}`
    : "improvement";
  return `  ${page}: ${move.figure} ${move.before} -> ${move.after}  (${direction})`;
}

describe("what each page verifies", () => {
  it("matches the recorded baseline", () => {
    const problems: string[] = [];

    for (const [page, before] of Object.entries(recorded)) {
      const after = current[page];
      if (after === undefined) {
        problems.push(`  ${page}: page is gone, and the baseline still lists it`);
        continue;
      }
      for (const move of movesOn(before, after)) problems.push(describeMove(page, move));
    }

    for (const page of Object.keys(current)) {
      if (!(page in recorded)) problems.push(`  ${page}: new page, not yet in the baseline`);
    }

    expect(
      problems,
      [
        `${BASELINE_FILE} no longer describes the content.`,
        "",
        ...problems,
        "",
        "A regression means a page states in its footer that it checks more than it now does.",
        "Find what stopped being checked before touching the baseline: on a prose page the usual",
        "cause is a line inserted between a command fence and the output fence below it, which",
        "silently unpairs them.",
        "",
        `Everything else here is fine, and recording it is one command: ${UPDATE_COMMAND}`,
      ].join("\n"),
    ).toEqual([]);
  });

  it("covers every page", () => {
    // A snapshot missing pages would pass while protecting none of them.
    expect(Object.keys(recorded).sort()).toEqual(Object.keys(current).sort());
  });
});

describe("the figures themselves", () => {
  it("never report more compared by shape than are compared at all", () => {
    for (const [page, figures] of Object.entries(current)) {
      expect(
        figureValue(figures, FIGURE.exact),
        `${page} reports more by shape than it checks`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("still find unpaired blocks somewhere", () => {
    // Several pages legitimately carry one: the error message a troubleshooting page opens on,
    // a config file a page tells you to write. If this ever reaches zero site-wide, the parser
    // has stopped recognising them and the count guards nothing.
    const total = Object.values(current).reduce((sum, figures) => sum + figures.unpaired, 0);
    expect(total).toBeGreaterThan(0);
  });
});
