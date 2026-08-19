import { existsSync, readFileSync } from "node:fs";
import { type Page, isCommandPage } from "./loader.js";
import { PROSE_CATEGORIES } from "./schema.js";
import { readSkipEntries } from "./replaySkips.js";
import { FIXTURE_DIR, fixtureScript, proseSource } from "../paths.js";
import { parseProsePage } from "./proseBlocks.js";

/** What the site can say about its own verification, counted from the content rather than
 *  written down. A page that boasts about checking its examples is the worst possible place
 *  for a number that has quietly gone stale.
 *
 *  Every figure here counts only what `npm run replay` actually runs. A page opts into the
 *  replay by having a setup script at `scripts/fixtures/<slug>.sh`; one without a setup script is
 *  skipped by the replay entirely, so counting its outputs would turn this page into the thing it
 *  exists to argue against. */
export interface VerificationStats {
  /** Pages of every kind. */
  pages: number;
  /** Command pages that replay: the ones carrying examples *and* a setup script. */
  commandPages: number;
  /** Command pages with no setup script, whose outputs nothing re-runs. */
  unreplayedCommandPages: number;
  /** Examples across every replayed command page. */
  examples: number;
  /** Examples that document an output block. */
  outputs: number;
  /** Documented outputs actually replayed on every push: the rest are exempt. */
  replayed: number;
  /** Documented outputs that declare `volatile:` — real, but not identical on your machine. */
  volatile: number;
  /** Sample-file blocks, themselves re-read from the sandbox and diffed. */
  fixtures: number;
  /** Examples exempted from the batch in scripts/fixtures/<command>.skip, each with a
   *  comment there saying how it was verified instead. */
  exemptions: number;
  /** Prose pages — concepts, lessons, recipes, Debian articles — whose documented output is
   *  replayed too. Counted separately because a prose page opts in by having a setup script,
   *  and most do not have one yet. */
  prosePages: number;
  /** Output blocks replayed on those pages. */
  proseOutputs: number;
}

/** Counts the prose pages that actually replay, and their output blocks.
 *
 *  Setup scripts are looked for in this repository whichever content tree is being built,
 *  because they belong to the harness; the pages themselves come from `contentDir`. */
function countProse(
  pages: Page[],
  contentDir: string,
  fixtureDir: string,
): { prosePages: number; proseOutputs: number } {
  let prosePages = 0;
  let proseOutputs = 0;
  for (const page of pages) {
    if (!(PROSE_CATEGORIES as readonly string[]).includes(page.category)) continue;
    if (!existsSync(fixtureScript(page.slug, fixtureDir))) continue;
    const source = proseSource(page.category, page.slug, contentDir);
    if (!existsSync(source)) continue;
    const { pairs } = parseProsePage(readFileSync(source, "utf-8"));
    const checked = pairs.filter((pair) => pair.comparison !== "skip").length;
    if (checked === 0) continue;
    prosePages++;
    proseOutputs += checked;
  }
  return { prosePages, proseOutputs };
}

export function verificationStats(
  pages: Page[],
  contentDir: string,
  fixtureDir: string = FIXTURE_DIR,
): VerificationStats {
  const allCommandPages = pages.filter(isCommandPage);
  const commandPages = allCommandPages.filter((page) => existsSync(fixtureScript(page.slug, fixtureDir)));

  let examples = 0;
  let outputs = 0;
  let volatile = 0;
  let fixtures = 0;
  let exemptions = 0;

  for (const page of commandPages) {
    fixtures += page.examples.fixtures?.length ?? 0;
    const titlesWithOutput = new Set<string>();
    for (const section of page.examples.sections) {
      for (const example of section.examples) {
        examples++;
        if (example.output !== undefined) {
          outputs++;
          titlesWithOutput.add(example.title);
        }
        if (example.volatile) volatile++;
      }
    }
    // Counted per page, against that page's own examples, because `replayed` subtracts this
    // figure from `outputs`. Counting every line in every .skip file instead meant an entry
    // naming an example that no longer exists — or a prose page's skip file, which is not in
    // `outputs` at all — quietly reduced the number the site advertises.
    exemptions += readSkipEntries(page.slug, fixtureDir).filter((title) => titlesWithOutput.has(title))
      .length;
  }

  const { prosePages, proseOutputs } = countProse(pages, contentDir, fixtureDir);
  return {
    pages: pages.length,
    commandPages: commandPages.length,
    unreplayedCommandPages: allCommandPages.length - commandPages.length,
    examples,
    outputs,
    replayed: outputs - exemptions + proseOutputs,
    volatile,
    fixtures,
    exemptions,
    prosePages,
    proseOutputs,
  };
}

/** Replaces `{{token}}` in a page's source with a counted figure.
 *
 *  Throws on a token with no value rather than shipping `{{outputs}}` to a reader, and on a
 *  value of zero, which on this page would always mean the counting broke rather than that
 *  the site genuinely has none of something. `unreplayedCommandPages` is the one figure allowed
 *  to be zero — zero is the state the site wants to be in, and saying so is the point. */
const ZERO_IS_MEANINGFUL: ReadonlySet<keyof VerificationStats> = new Set(["unreplayedCommandPages"]);

function isStatName(token: string, stats: VerificationStats): token is keyof VerificationStats {
  return Object.hasOwn(stats, token);
}

export function fillStats(source: string, stats: VerificationStats): string {
  return source.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => {
    if (!isStatName(token, stats)) {
      throw new Error(`about page: unknown statistic {{${token}}} (have: ${Object.keys(stats).join(", ")})`);
    }
    const value = stats[token];
    if (value === 0 && !ZERO_IS_MEANINGFUL.has(token)) {
      throw new Error(`about page: {{${token}}} counted zero, which means the counting is broken`);
    }
    return String(value);
  });
}
