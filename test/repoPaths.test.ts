import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../src/paths.js";

/* The tools print repository paths at people: "see .claude/skills/cross-link-pages/SKILL.md",
 * "re-capture with scripts/adopt-real-output.ts". Nothing checked those, so a rename would
 * leave a message confidently naming a file that no longer exists — and the message is read
 * precisely when someone is already stuck. */

/** Paths that appear inside string literals in the tools, excluding the ones that are
 *  patterns rather than files (`scripts/fixtures/<command>.skip`). */
const REFERENCE = /(?:\.claude|scripts|src|test|content|styles|public)\/[A-Za-z0-9._/-]+\.(?:ts|sh|md|py|yaml|yml|css)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith(".ts")
        ? [join(dir, entry.name)]
        : [],
  );
}

describe("repository paths named in the tools", () => {
  it("all exist", () => {
    const missing: string[] = [];
    for (const file of [...sourceFiles("src"), ...sourceFiles("scripts")]) {
      const source = readFileSync(join(ROOT, file), "utf-8");
      for (const match of source.match(REFERENCE) ?? []) {
        // Templated paths name a convention, not a file: `scripts/fixtures/${name}.sh`.
        if (match.includes("$") || match.includes("<")) continue;
        if (!existsSync(join(ROOT, match))) missing.push(`${file} names ${match}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
