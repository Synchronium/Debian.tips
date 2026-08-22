// A per-page snapshot of what the replay checks, so an edit cannot quietly reduce it.
//
// Rewriting prose is the one routine operation here that can weaken verification while every gate
// stays green. An output fence pairs to its command only when it opens on the line immediately
// after that command's fence closes, so a sentence inserted between the two turns a checked
// example into an unpaired block. The replay prints that as "not checkable" and fails nothing, and
// the page goes on stating in its footer how much it checks while checking less.
//
// The figures are the ones a page states about itself (`src/content/pageChecks.ts`), plus the
// unpaired count only the prose parser sees. `test/verificationBaseline.test.ts` compares them
// against `test/verification-baseline.json`, which `scripts/update-verification-baseline.ts`
// rewrites.
import { readFileSync } from "node:fs";
import { loadContent, type Page } from "../../src/content/loader.js";
import { parseProsePage } from "../../src/content/proseBlocks.js";
import { PROSE_CATEGORIES } from "../../src/content/schema.js";
import { CONTENT_DIR, FIXTURE_DIR, proseSource } from "../../src/paths.js";
import type { PageChecks } from "../../src/content/pageChecks.js";

export interface PageVerification extends PageChecks {
  /** Output fences with no command fence immediately above them: a claim about what something
   *  prints that nothing can check.
   *
   *  Several are legitimate and always will be — the error message a troubleshooting page opens
   *  on, a config file a page tells you to write. The count is here because it going *up* is how
   *  a broken pair announces itself, and nothing else fails when one breaks. Command pages state
   *  their examples as YAML rather than fences, so theirs is always zero. */
  unpaired: number;
}

/** Keyed by `category/slug`, which is unique site-wide even though slugs are only unique per
 *  category. Sorted, so the committed file diffs one page at a time. */
export type VerificationBaseline = Record<string, PageVerification>;

function unpairedBlocks(page: Page, contentDir: string): number {
  if (!(PROSE_CATEGORIES as readonly string[]).includes(page.category)) return 0;
  const source = readFileSync(proseSource(page.category, page.slug, contentDir), "utf-8");
  return parseProsePage(source).unpaired;
}

export async function verificationBaseline(
  contentDir: string = CONTENT_DIR,
  fixtureDir: string = FIXTURE_DIR,
): Promise<VerificationBaseline> {
  const { pages } = await loadContent(contentDir, fixtureDir);
  const baseline: VerificationBaseline = {};
  for (const page of [...pages].sort((a, b) => pageKey(a).localeCompare(pageKey(b)))) {
    baseline[pageKey(page)] = { ...page.checks, unpaired: unpairedBlocks(page, contentDir) };
  }
  return baseline;
}

export const pageKey = (page: Page): string => `${page.category}/${page.slug}`;

/** Which way a figure may not move, and what a move that way costs. A change in the other
 *  direction is an improvement and still has to be recorded, so that the snapshot stays a
 *  description of the site rather than of the site as it once was. */
export const DIRECTION = { mustNotFall: "mustNotFall", mustNotRise: "mustNotRise" } as const;
export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];

/** What the comparison asserts about. `byShape` is deliberately not one of them: it is a subset
 *  of `checked`, so a page adding two shape-compared examples raises both while weakening
 *  nothing. What must not fall is the number compared *exactly*, which `exact` derives. */
export const FIGURE = {
  checked: "checked",
  exact: "exact",
  exempt: "exempt",
  fixtures: "fixtures",
  unpaired: "unpaired",
} as const;
export type FigureName = (typeof FIGURE)[keyof typeof FIGURE];

interface Figure {
  direction: Direction;
  /** Said of a move in the forbidden direction, and read by someone who does not yet know
   *  whether they have broken something. */
  regression: string;
}

export const FIGURES: Record<FigureName, Figure> = {
  [FIGURE.checked]: { direction: DIRECTION.mustNotFall, regression: "fewer outputs are compared at all" },
  [FIGURE.exact]: {
    direction: DIRECTION.mustNotFall,
    regression: "fewer outputs are compared byte for byte",
  },
  [FIGURE.exempt]: { direction: DIRECTION.mustNotRise, regression: "more outputs are exempt from the batch" },
  [FIGURE.fixtures]: { direction: DIRECTION.mustNotFall, regression: "fewer sample-file blocks are diffed" },
  [FIGURE.unpaired]: {
    direction: DIRECTION.mustNotRise,
    regression: "more output blocks are paired to no command",
  },
};

/** Outputs compared byte for byte rather than by shape. Derived, so the committed file records
 *  only the figures a page states about itself plus the unpaired count. */
export const exactComparisons = (figures: PageVerification): number => figures.checked - figures.byShape;

export function figureValue(figures: PageVerification, name: FigureName): number {
  switch (name) {
    case FIGURE.checked:
      return figures.checked;
    case FIGURE.exact:
      return exactComparisons(figures);
    case FIGURE.exempt:
      return figures.exempt;
    case FIGURE.fixtures:
      return figures.fixtures;
    case FIGURE.unpaired:
      return figures.unpaired;
  }
}

export const isRegression = (name: FigureName, before: number, after: number): boolean =>
  FIGURES[name].direction === DIRECTION.mustNotFall ? after < before : after > before;

/** Printed by the test that fails when the snapshot is out of date, so the reader is told how to
 *  fix it rather than left to find the script. Here because the test and `package.json` would
 *  otherwise spell it separately, and a renamed script would leave the message wrong. */
export const UPDATE_COMMAND = "npm run baseline:update";
