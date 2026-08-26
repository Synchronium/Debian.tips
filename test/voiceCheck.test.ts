import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SEVERITY, checkFile, inScope, proseLines } from "../scripts/voice-check.js";
import { ROOT } from "../src/paths.js";

/* The property worth a test is what the checker refuses to look at. `output:` and `fixtures:`
 * hold what a command really printed, so a finding there would invite editing captured text to
 * suit a style rule, which is the one edit this project can never make. */

function write(name: string, body: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "voice-")), name);
  writeFileSync(path, body);
  return path;
}

const EXAMPLES = `command: demo
fixtures:
  - name: notes.txt
    note: "a note holding an em dash — which is prose and is checked"
    content: |
      captured file contents — never checked
sections:
  - title: "A section"
    examples:
      - title: "An example"
        code: echo "load-bearing — a command, never checked"
        description: "This is the difference that matters, which is prose and is checked."
        output: |2
          captured output — load-bearing — never checked
        level: basic
`;

const MARKDOWN = `---
title: "A page"
---

Prose with an em dash — which is checked.

\`\`\`bash
echo "load-bearing — inside a fence, never checked"
\`\`\`

\`\`\`
captured output — never checked
\`\`\`
`;

describe("voice-check scoping", () => {
  it("checks a caption but never the output beneath it", () => {
    const findings = checkFile(write("examples.yaml", EXAMPLES));
    const flagged = findings.map((f) => f.text);

    expect(flagged).toContain("This is the difference that matters");
    // The note is prose, so its em dash counts; the three below it are captured or are code.
    expect(findings.filter((f) => f.rule.id === "em-dash")).toHaveLength(1);
    expect(flagged).not.toContain("load-bearing");
  });

  it("checks markdown prose but never a fenced block", () => {
    const findings = checkFile(write("page.md", MARKDOWN));

    expect(findings.filter((f) => f.rule.id === "em-dash")).toHaveLength(1);
    expect(findings.every((f) => f.line < 7)).toBe(true);
  });

  it("drops every line of a block scalar, however long", () => {
    const lines = proseLines(
      "examples.yaml",
      [
        "        output: |2",
        "          one — two",
        "",
        "          three — four",
        "        level: basic",
      ].join("\n"),
    );

    expect(lines.map((l) => l.text.trim())).toEqual(["level: basic"]);
  });

  it("reads a source file's comments and never its code", () => {
    // The rules quote the phrases they ban, so a checker that read code would fail on its own
    // rule table. A banned phrase inside a string literal or a regular expression is data.
    const source = [
      "// A load-bearing comment, which is a finding.",
      "/* A block comment,",
      "   still inside the block, load-bearing again. */",
      'const banned = "load-bearing";',
      "const pattern = /load-bearing/g;",
      "# a shell comment, load-bearing",
    ].join("\n");
    // Assembled rather than written out: test/documentedPaths.test.ts scans this file for
    // repository paths and would report a literal one, quite correctly, as naming no such file.
    // Only the extension decides how the line is read.
    const lines = proseLines(`src/${"thing"}.ts`, source).map((entry) => entry.line);
    expect(lines).toEqual([1, 2, 3, 6]);
  });

  it("exempts the synthetic content tree the build tests assert against", () => {
    // A fixture is a stand-in, not prose. Holding one to the guide invites improving a sentence
    // that a build test compares character for character.
    const findings = checkFile(join(ROOT, "test/fixtures/content/about.md"));
    expect(findings).toEqual([]);
  });

  it("rates the banned constructions as failures", () => {
    const findings = checkFile(write("page.md", "The real question is whether this fails.\n"));

    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule.severity).toBe(SEVERITY.fail);
  });
});

/* The hook is handed any path the session just wrote, so it decides scope on its own. Naming a
 * file explicitly is still an instruction to check it, which is why only the hook consults this. */
describe("voice-check scope", () => {
  it("covers the prose the guide claims", () => {
    expect(inScope(join(ROOT, "content/commands/ls/index.md"))).toBe(true);
    expect(inScope(join(ROOT, "content/commands/ls/examples.yaml"))).toBe(true);
    expect(inScope(join(ROOT, "docs/adr/0001-anything.md"))).toBe(true);
    expect(inScope(join(ROOT, ".claude/reference/voice.md"))).toBe(true);
    expect(inScope(join(ROOT, "README.md"))).toBe(true);
    expect(inScope(join(ROOT, "CLAUDE.md"))).toBe(true);
  });

  // Scope is an allowlist, so the markdown path below needs no file behind it: any directory the
  // guide does not claim answers false, which is what a session's own scratch notes rely on.
  it("leaves untracked notes and non-prose alone", () => {
    expect(inScope(join(ROOT, "scratch/notes/draft.md"))).toBe(false);
    expect(inScope(join(ROOT, "content/commands/ls/notes.txt"))).toBe(false);
    expect(inScope(join(ROOT, "styles/site.css"))).toBe(false);
    expect(inScope("/etc/passwd.md")).toBe(false);
  });

  it("covers the code, for its comments", () => {
    // voice.md's opening claims code comments, because ADR-0017 puts every one of them a click
    // away from a page it helped produce. The checker read only content/ and the documentation
    // until this, so the guide's "the corpus sits at zero" was true of half of what it claimed.
    expect(inScope(join(ROOT, "src/templates/layout.ts"))).toBe(true);
    expect(inScope(join(ROOT, "scripts/voice-check.ts"))).toBe(true);
    expect(inScope(join(ROOT, "scripts/fixtures/ls.sh"))).toBe(true);
    expect(inScope(join(ROOT, "test/build.test.ts"))).toBe(true);
  });

  it("resolves a relative path before deciding", () => {
    expect(inScope(join(ROOT, "content/commands/ls/index.md"))).toBe(true);
    expect(inScope(relative(process.cwd(), join(ROOT, "content/commands/ls/index.md")))).toBe(true);
  });
});
