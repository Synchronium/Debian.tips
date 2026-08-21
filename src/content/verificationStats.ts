import { existsSync, readFileSync } from "node:fs";
import { type Page, isCommandPage } from "./loader.js";
import { PROSE_CATEGORIES } from "./schema.js";
import { FIXTURE_DIR, fixtureScript, proseSource } from "../paths.js";
import { commandChecks, proseChecks } from "./pageChecks.js";

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
  /** Prose pages with no setup script, whose outputs nothing re-runs — the counterpart to
   *  `unreplayedCommandPages`.
   *
   *  A page that *has* a script but every one of whose blocks is exempt is in neither figure.
   *  It opted in, the replay runs it, and it reports its exemptions; it simply contributes no
   *  automated outputs. Counting it here would report an explicit exemption as an oversight. */
  unreplayedProsePages: number;
}

/** Counts the prose pages that actually replay, and their output blocks.
 *
 *  Setup scripts are looked for in this repository whichever content tree is being built,
 *  because they belong to the harness; the pages themselves come from `contentDir`. */
function countProse(
  pages: Page[],
  contentDir: string,
  fixtureDir: string,
): { prosePages: number; proseOutputs: number; unreplayedProsePages: number } {
  let prosePages = 0;
  let proseOutputs = 0;
  let unreplayedProsePages = 0;
  for (const page of pages) {
    if (!(PROSE_CATEGORIES as readonly string[]).includes(page.category)) continue;
    if (!existsSync(fixtureScript(page.slug, fixtureDir))) {
      unreplayedProsePages++;
      continue;
    }
    // A page in the model always has a source file; this only guards a caller passing a content
    // directory the pages did not come from.
    const source = proseSource(page.category, page.slug, contentDir);
    if (!existsSync(source)) continue;
    // `page.checks` is this same count, taken from the loader. Recomputed from the file here
    // because the synthetic tree in `test/fixtures/` is counted without going through a build;
    // a test asserts the two agree on the real tree.
    const { checked } = proseChecks(readFileSync(source, "utf-8"));
    if (checked === 0) continue;
    prosePages++;
    proseOutputs += checked;
  }
  return { prosePages, proseOutputs, unreplayedProsePages };
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
    for (const section of page.examples.sections) {
      for (const example of section.examples) {
        examples++;
        if (example.output !== undefined) outputs++;
        // `volatile` is not `byShape`: it says what will differ for a reader, and most output
        // carrying it is still compared exactly. Two figures, two questions.
        if (example.volatile) volatile++;
      }
    }
    // Per page, against that page's own examples, because `replayed` subtracts this from
    // `outputs`. Counting `.skip` lines directly would let an entry naming a renamed example —
    // or a prose page's exemption, which is not in `outputs` at all — reduce the figure the
    // site advertises. `commandChecks` is what the page itself states, so the total and the
    // per-page claim are one count.
    const checks = commandChecks(page.examples, page.slug, fixtureDir);
    fixtures += checks.fixtures;
    exemptions += checks.exempt;
  }

  const { prosePages, proseOutputs, unreplayedProsePages } = countProse(pages, contentDir, fixtureDir);
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
    unreplayedProsePages,
  };
}

/** Replaces `{{token}}` in a page's source with a counted figure.
 *
 *  Throws on a token with no value rather than shipping `{{outputs}}` to a reader, and on a
 *  value of zero, which on this page would always mean the counting broke rather than that
 *  the site genuinely has none of something. The two "unreplayed" figures are the exception —
 *  zero is the state the site wants to be in, and saying so is the point. */
const ZERO_IS_MEANINGFUL: ReadonlySet<keyof VerificationStats> = new Set([
  "unreplayedCommandPages",
  "unreplayedProsePages",
]);

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
