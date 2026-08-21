// What `npm run replay -- <slug>` will actually check on one page.
//
// The site now states these figures on the page itself, which makes them a claim like any
// other — and there were already three places computing them: `src/content/stats.ts` for the
// about page's totals, `scripts/verify-examples.ts` for a command page, `scripts/verify-prose.ts`
// for a prose one. A fourth copy in the template is how a page ends up advertising 51 outputs
// while the command prints 49, so the partition lives here and everything else folds over it.
//
// The same reasoning that produced `src/content/replaySkips.ts`, one level up: that file exists
// because the build and the replay each parsed `.skip` with their own copy of the line
// filtering. This is the rest of that answer.
import { readSkipEntries } from "./replaySkips.js";
import { parseProsePage } from "./proseBlocks.js";
import { COMPARISON, type Example, type ExamplesFile } from "./schema.js";

/** An example that documents an output, with the section it came from — what the replay runs. */
export type ReplayedExample = Example & { section: string };

export interface CommandPartition {
  /** Documented outputs the replay compares. */
  checked: ReplayedExample[];
  /** Documented outputs listed in `scripts/fixtures/<slug>.skip`, which the batch cannot run. */
  exempt: ReplayedExample[];
}

/** Splits a command page's examples the way the replay does.
 *
 *  A `.skip` entry only exempts something when it names an example that documents an output on
 *  *this* page. Two things depend on that: `scripts/fixtures/tar.skip` carries a note and no
 *  entries at all, and an entry naming a renamed example would otherwise reduce a published
 *  figure while exempting nothing. The harness rejects the stale entry separately; this counts
 *  what is really exempt either way. */
export function partitionExamples(doc: ExamplesFile, slug: string, fixtureDir?: string): CommandPartition {
  const withOutput: ReplayedExample[] = [];
  for (const section of doc.sections) {
    for (const example of section.examples) {
      if (example.output !== undefined) withOutput.push({ section: section.title, ...example });
    }
  }

  const titles = new Set(withOutput.map((example) => example.title));
  const skipped = new Set(readSkipEntries(slug, fixtureDir).filter((title) => titles.has(title)));

  return {
    checked: withOutput.filter((example) => !skipped.has(example.title)),
    exempt: withOutput.filter((example) => skipped.has(example.title)),
  };
}

/** The figures a page states about itself, and the totals on `/about/` sum. Deliberately not a
 *  count of everything a page *has*: an example with no `output:` claims nothing, so it is not
 *  in `checked`, and an exempt one is not in `checked` either. */
export interface PageChecks {
  /** Documented outputs the replay compares on every push. */
  checked: number;
  /** Of `checked`, the ones compared by shape rather than byte for byte.
   *
   *  Driven by `compare: "shape"` and never by `volatile:` — see the note on `compare` in
   *  `src/content/schema.ts`. Most volatile output is still compared exactly, because the mask
   *  for it is anchored to the line that carries it, and an anchored mask is stricter. Counting
   *  `volatile` here would overstate how loosely the page is checked. */
  byShape: number;
  /** Documented outputs a batch run cannot reproduce, each named in the page's `.skip` file
   *  with a note on how it was verified instead. */
  exempt: number;
  /** Sample-file blocks re-read from the sandbox and diffed. Command pages only. */
  fixtures: number;
}

export function commandChecks(doc: ExamplesFile, slug: string, fixtureDir?: string): PageChecks {
  const { checked, exempt } = partitionExamples(doc, slug, fixtureDir);
  return {
    checked: checked.length,
    byShape: checked.filter((example) => example.compare === COMPARISON.shape).length,
    exempt: exempt.length,
    fixtures: doc.fixtures?.length ?? 0,
  };
}

export function proseChecks(source: string): PageChecks {
  const { pairs } = parseProsePage(source);
  const checked = pairs.filter((pair) => pair.comparison !== COMPARISON.skip);
  return {
    checked: checked.length,
    byShape: checked.filter((pair) => pair.comparison === COMPARISON.shape).length,
    exempt: pairs.filter((pair) => pair.comparison === COMPARISON.skip).length,
    fixtures: 0,
  };
}

/** Nothing checked and nothing exempt: a page with no documented output at all. Distinct from
 *  a page whose blocks are every one of them exempt, which checks nothing but claims nothing
 *  unverified either — `/about/` leaves the second out of both its counters, and the page says
 *  so itself. */
export const NO_CHECKS: PageChecks = { checked: 0, byShape: 0, exempt: 0, fixtures: 0 };
