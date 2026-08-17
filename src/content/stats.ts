import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "./loader.js";

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
  return {
    pages: pages.length,
    commandPages: commandPages.length,
    examples,
    outputs,
    replayed: outputs - exemptions,
    volatile,
    fixtures,
    exemptions,
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
