import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEVERITY, checkFile, proseLines } from "../scripts/voice-check.js";

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

  it("rates the banned constructions as failures", () => {
    const findings = checkFile(write("page.md", "The real question is whether this fails.\n"));

    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule.severity).toBe(SEVERITY.fail);
  });
});
