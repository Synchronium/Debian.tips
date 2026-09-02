// What `npm run replay -- <slug>` will actually check on one page.
//
// The site states these figures on the page itself, which makes them a claim like any other, and
// three other places need the same answer: the about page's totals, the command-page replay and
// the prose-page replay. The partition lives here and everything else folds over it, so a page
// cannot advertise 51 outputs beside a command that prints 49.
import { readSkipEntries } from "./replaySkips.js";
import { parseProsePage } from "./proseBlocks.js";
import { COMPARISON, type Example, type ExamplesFile } from "./schema.js";

/** An example that documents an output, with the section it came from: what the replay runs. */
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
 *  *this* page: a skip file may carry a note and no entries at all, and an entry naming a renamed
 *  example would otherwise reduce a published figure while exempting nothing. The harness rejects
 *  the stale entry separately; this counts what is really exempt either way. */
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
   *  Driven by `compare: "shape"` and never by `volatile:`; see the note on `compare` in
   *  `src/content/schema.ts`. Most volatile output is still compared exactly, because the mask
   *  for it is anchored to the line that carries it, and an anchored mask is stricter. Counting
   *  `volatile` here would overstate how loosely the page is checked. */
  byShape: number;
  /** Of `checked`, the ones whose every line is compared but whose order is not: `unordered:` on
   *  an example, for a command that picks the order itself.
   *
   *  An output compared by shape *and* unordered is counted in `byShape`, so the three figures
   *  partition `checked` and the sentence a page states about itself adds up. The overlap goes to
   *  the looser of the two deliberately: rounding the other way would let a page claim a
   *  strictness it is not held to. */
  unordered: number;
  /** Documented outputs a batch run cannot reproduce. A command page names each in its `.skip`
   *  file; a prose page carries the reason inline, above the block.
   *
   *  On a prose page this covers both ways a block can go unreproduced: a pair marked
   *  `verify: skip`, and an output fence with no command above it at all. They are the same claim
   *  to a reader, who sees an output block either way, so they are counted as one figure and
   *  described by one sentence. See ADR-0021. */
  exempt: number;
  /** Sample-file blocks re-read from the sandbox and diffed. Command pages only. */
  fixtures: number;
}

export function commandChecks(doc: ExamplesFile, slug: string, fixtureDir?: string): PageChecks {
  const { checked, exempt } = partitionExamples(doc, slug, fixtureDir);
  return {
    checked: checked.length,
    byShape: checked.filter((example) => example.compare === COMPARISON.shape).length,
    unordered: checked.filter((example) => example.unordered === true && example.compare !== COMPARISON.shape)
      .length,
    exempt: exempt.length,
    fixtures: doc.fixtures?.length ?? 0,
  };
}

export function proseChecks(source: string): PageChecks {
  const { pairs, unpaired } = parseProsePage(source);
  const checked = pairs.filter((pair) => pair.comparison !== COMPARISON.skip);
  return {
    checked: checked.length,
    byShape: checked.filter((pair) => pair.comparison === COMPARISON.shape).length,
    // Always zero: a prose page has no way to spell `unordered:`, because no prose page has
    // needed one. ADR-0026 says what adding it would take.
    unordered: 0,
    exempt: pairs.filter((pair) => pair.comparison === COMPARISON.skip).length + unpaired.length,
    fixtures: 0,
  };
}
