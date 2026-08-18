import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "./loader.js";
import { parseProsePage } from "../../scripts/lib/proseBlocks.js";

/** What the site can say about its own verification, counted from the content rather than
 *  written down. A page that boasts about checking its examples is the worst possible place
 *  for a number that has quietly gone stale. */
export interface VerificationStats {
  /** Pages of every kind. */
  pages: number;
  /** Command pages, the ones carrying examples. */
  commandPages: number;
  /** Examples across every command page. */
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

const PROSE_CATEGORIES = ["concepts", "scripting", "recipes", "debian"];

/** Counts the prose pages that actually replay, and their output blocks. A page without a
 *  setup script is not replayed, so counting its blocks here would overstate what is
 *  checked — the one thing this page must never do. */
function countProse(pages: Page[], repoRoot: string): { prosePages: number; proseOutputs: number } {
  let prosePages = 0;
  let proseOutputs = 0;
  for (const page of pages) {
    if (!PROSE_CATEGORIES.includes(page.category)) continue;
    if (!existsSync(join(repoRoot, "scripts", "fixtures", `${page.slug}.sh`))) continue;
    const source = join(repoRoot, "content", page.category, `${page.slug}.md`);
    if (!existsSync(source)) continue;
    const { pairs } = parseProsePage(readFileSync(source, "utf-8"));
    const checked = pairs.filter((pair) => pair.comparison !== "skip").length;
    if (checked === 0) continue;
    prosePages++;
    proseOutputs += checked;
  }
  return { prosePages, proseOutputs };
}

/** Counts entries in the .skip files, which live beside the fixture scripts rather than in
 *  content/ because they belong to the replay rather than to a page. */
function countExemptions(repoRoot: string): number {
  const dir = join(repoRoot, "scripts", "fixtures");
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((file) => file.endsWith(".skip"))
    .reduce((total, file) => {
      const entries = readFileSync(join(dir, file), "utf-8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      return total + entries.length;
    }, 0);
}

export function verificationStats(pages: Page[], repoRoot: string): VerificationStats {
  const commandPages = pages.filter((page) => page.examples);
  let examples = 0;
  let outputs = 0;
  let volatile = 0;
  let fixtures = 0;

  for (const page of commandPages) {
    fixtures += page.examples?.fixtures?.length ?? 0;
    for (const section of page.examples?.sections ?? []) {
      for (const example of section.examples) {
        examples++;
        if (example.output !== undefined) outputs++;
        if (example.volatile) volatile++;
      }
    }
  }

  const exemptions = countExemptions(repoRoot);
  const { prosePages, proseOutputs } = countProse(pages, repoRoot);
  return {
    pages: pages.length,
    commandPages: commandPages.length,
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
 *  the site genuinely has none of something. */
export function fillStats(source: string, stats: VerificationStats): string {
  return source.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => {
    const value = (stats as unknown as Record<string, number | undefined>)[token];
    if (value === undefined) {
      throw new Error(`about page: unknown statistic {{${token}}} (have: ${Object.keys(stats).join(", ")})`);
    }
    if (value === 0) throw new Error(`about page: {{${token}}} counted zero, which means the counting is broken`);
    return String(value);
  });
}
