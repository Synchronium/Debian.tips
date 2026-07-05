import { describe, expect, it } from "vitest";
import { exampleCard } from "../src/templates/partials/exampleCard.js";
import type { Example } from "../src/content/schema.js";

function example(overrides: Partial<Example>): Example {
  return { title: "Title", code: "echo hi", description: "Desc.", level: "basic", ...overrides };
}

describe("exampleCard", () => {
  it("adds data-prompt to a single-line, unpiped command", async () => {
    const html = await exampleCard("sec", 1, example({ code: 'grep "x" file' }));
    expect(html).toContain('data-prompt="1"');
  });

  it("omits data-prompt for a piped command", async () => {
    const html = await exampleCard("sec", 1, example({ code: 'ps aux | grep nginx' }));
    expect(html).not.toContain("data-prompt");
  });

  it("omits data-prompt for a multi-line command", async () => {
    const html = await exampleCard("sec", 1, example({ code: "for f in *.txt; do\n  echo \"$f\"\ndone" }));
    expect(html).not.toContain("data-prompt");
  });

  it("escapes the raw command into the copy button's data-copy attribute", async () => {
    const html = await exampleCard("sec", 1, example({ code: 'echo "hi"' }));
    expect(html).toContain('data-copy="echo &quot;hi&quot;"');
  });

  it("renders an example-danger class when danger is set", async () => {
    const html = await exampleCard("sec", 1, example({ danger: true }));
    expect(html).toContain('class="example example-danger"');
  });

  it("renders a collapsible output block only when output is present", async () => {
    const withOutput = await exampleCard("sec", 1, example({ output: "hi\n" }));
    const withoutOutput = await exampleCard("sec", 1, example({}));
    expect(withOutput).toContain("example-output");
    expect(withoutOutput).not.toContain("example-output");
  });
});
