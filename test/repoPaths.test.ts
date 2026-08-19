import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../src/paths.js";

/* The tools print repository paths at people: "see .claude/skills/cross-link-pages/SKILL.md",
 * "re-capture with scripts/adopt-real-output.ts". Nothing checked those, so a rename would
 * leave a message confidently naming a file that no longer exists — and the message is read
 * precisely when someone is already stuck. */

/** Paths that appear inside the tools and the documentation, excluding the ones that are
 *  patterns rather than files (`scripts/fixtures/<command>.skip`).
 *
 *  `mjs` is in the list because it was once missing from it, which is how eight references to
 *  `verify-examples.mjs` survived the harness being rewritten in TypeScript — a check that
 *  cannot see a file extension reports a clean run either way. Plain `js` is deliberately *not*
 *  here: TypeScript's NodeNext imports spell every neighbour `./thing.js`, and matching those
 *  finds a relative specifier rather than a path from the repository root. */
const REFERENCE =
  /(?:\.claude|scripts|src|test|content|styles|public)\/[A-Za-z0-9._/-]+\.(?:ts|mjs|sh|md|py|yaml|yml|css)/g;

/** Extensions worth scanning: the tools themselves, the setup scripts that carry a lot of
 *  hard-won commentary, and the documentation, whose whole job since CLAUDE.md was split into
 *  `.claude/reference/` is to point at other files. */
const SCANNED = [".ts", ".sh", ".md"];

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : SCANNED.some((ext) => entry.name.endsWith(ext))
        ? [join(dir, entry.name)]
        : [],
  );
}

/** NodeNext resolution means a TypeScript file imports its neighbour as `./thing.js` while the
 *  file on disk is `thing.ts`. Both spellings are correct here, so a `.js` specifier resolves
 *  if either exists. */
function resolves(path: string): boolean {
  if (existsSync(join(ROOT, path))) return true;
  return /\.m?js$/.test(path) && existsSync(join(ROOT, path.replace(/\.m?js$/, ".ts")));
}

describe("repository paths named in the tools", () => {
  it("all exist", () => {
    const missing: string[] = [];
    // `test` and `README.md` are scanned too. They were not, and two references rotted there
    // unseen: comments naming `verify-examples.mjs` two rewrites after it stopped being an
    // `.mjs` file, and a `PLAN-BUILD.md` that has never existed in this repository.
    for (const file of [
      ...sourceFiles("src"),
      ...sourceFiles("scripts"),
      ...sourceFiles("test"),
      ...sourceFiles(".claude"),
      "CLAUDE.md",
      "README.md",
    ]) {
      // A setup script's *comments* name real repository paths; its body names paths inside
      // the sandbox, and several fixtures deliberately create sample files whose names look
      // like repository paths (a deploy script under a scripts directory, an entry point under
      // a src one). Only the commentary is a claim about this repository.
      const raw = readFileSync(join(ROOT, file), "utf-8");
      const source = file.endsWith(".sh")
        ? raw
            .split("\n")
            .filter((line) => line.trimStart().startsWith("#"))
            .join("\n")
        : raw;
      for (const match of source.match(REFERENCE) ?? []) {
        // Templated paths name a convention, not a file: `scripts/fixtures/${name}.sh`.
        if (match.includes("$") || match.includes("<")) continue;
        if (!resolves(match)) missing.push(`${file} names ${match}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
