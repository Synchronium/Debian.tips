import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../src/paths.js";

/* The tools and the documentation print repository paths at people: "see
 * .claude/skills/cross-link-pages/SKILL.md", "re-capture with scripts/adopt-real-output.ts".
 * Nothing else checks those, so a rename leaves a message confidently naming a file that no
 * longer exists, and the message is read precisely when someone is already stuck. */

/** Paths that appear inside the tools and the documentation, excluding the ones that are
 *  patterns rather than files (`scripts/fixtures/<command>.skip`).
 *
 *  An extension missing from this list is a whole class of reference the check cannot see, and
 *  it reports a clean run either way, so add one when a file of that kind starts being named.
 *  Plain `js` is deliberately *not* here: TypeScript's NodeNext imports spell every neighbour
 *  `./thing.js`, and matching those finds a relative specifier rather than a repository path. */
const REFERENCE =
  /(?:\.claude|scripts|src|test|content|styles|public)\/[A-Za-z0-9._/-]+\.(?:ts|mjs|sh|md|py|yaml|yml|css|json)/g;

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

/** A superseded ADR names the files that enforced a decision the repository no longer holds, and
 *  `docs/adr/README.md` requires it to be left otherwise intact: its reasoning is the useful
 *  thing about it, and editing that to match the decision which replaced it destroys the record.
 *  So the paths in one are history rather than a claim about the repository as it stands, and a
 *  check that demands they still resolve is asking for the record to be falsified. */
function isSupersededRecord(source: string): boolean {
  return /^- \*\*Status:\*\* Superseded by /m.test(source);
}

describe("repository paths named in the tools", () => {
  it("all exist", () => {
    const missing: string[] = [];
    // `test`, `docs` and `README.md` are all scanned. An ADR names the test or the gate that
    // enforces its decision, and a decision whose enforcement has been renamed away is exactly
    // the one worth being told about.
    for (const file of [
      ...sourceFiles("src"),
      ...sourceFiles("scripts"),
      ...sourceFiles("test"),
      ...sourceFiles(".claude"),
      ...sourceFiles("docs"),
      "CLAUDE.md",
      "README.md",
    ]) {
      // A setup script's *comments* name real repository paths; its body names paths inside
      // the sandbox, and several fixtures deliberately create sample files whose names look
      // like repository paths (a deploy script under a scripts directory, an entry point under
      // a src one). Only the commentary is a claim about this repository.
      const raw = readFileSync(join(ROOT, file), "utf-8");
      if (isSupersededRecord(raw)) continue;
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
