import { describe, expect, it } from "vitest";
import { exampleCard } from "../src/templates/partials/exampleCard.js";
import type { Example } from "../src/content/schema.js";

function example(overrides: Partial<Example>): Example {
  return { title: "Title", code: "echo hi", description: "Desc.", level: "basic", ...overrides };
}

/** The card's markup as a string. `exampleCard` returns `Raw`, and every assertion here is about
 *  the markup it carries rather than about the wrapper. */
const card = async (...args: Parameters<typeof exampleCard>): Promise<string> =>
  (await exampleCard(...args)).value;

describe("exampleCard", () => {
  it("adds data-prompt to a single-line, unpiped command", async () => {
    const html = await card("sec", 1, example({ code: 'grep "x" file' }));
    expect(html).toContain('data-prompt="1"');
  });

  it("omits data-prompt for a piped command", async () => {
    const html = await card("sec", 1, example({ code: "ps aux | grep nginx" }));
    expect(html).not.toContain("data-prompt");
  });

  it("omits data-prompt for a multi-line command", async () => {
    const html = await card("sec", 1, example({ code: 'for f in *.txt; do\n  echo "$f"\ndone' }));
    expect(html).not.toContain("data-prompt");
  });

  it("escapes the raw command into the copy button's data-copy attribute", async () => {
    const html = await card("sec", 1, example({ code: 'echo "hi"' }));
    expect(html).toContain('data-copy="echo &quot;hi&quot;"');
  });

  it("renders an example-danger class when danger is set", async () => {
    const html = await card("sec", 1, example({ danger: true }));
    expect(html).toContain('class="example example-danger"');
  });

  it("renders the description as inline markdown, not escaped literal text", async () => {
    const html = await card("sec", 1, example({ description: "`-g` replaces *every* match." }));
    expect(html).toContain("<code>-g</code> replaces <em>every</em> match.");
    expect(html).not.toContain("`");
  });

  it("renders a collapsible output block only when output is present", async () => {
    const withOutput = await card("sec", 1, example({ output: "hi\n" }));
    const withoutOutput = await card("sec", 1, example({}));
    expect(withOutput).toContain("example-output");
    expect(withoutOutput).not.toContain("example-output");
  });
});

it("tells the reader what will differ on a volatile example", async () => {
  const html = await card("status", 1, {
    title: "Read a service's full status block",
    code: "systemctl status cron",
    description: "The whole block.",
    output: "Main PID: 87 (cron)",
    volatile: "the PID and memory figures come from your machine",
    level: "basic",
  });
  expect(html).toContain("Your output will differ:");
  expect(html).toContain("the PID and memory figures come from your machine");
});

it("says nothing about differing output on an ordinary example", async () => {
  const html = await card("count", 1, {
    title: "Count lines",
    code: "wc -l report.txt",
    description: "Counts newlines.",
    output: "40 report.txt",
    level: "basic",
  });
  expect(html).not.toContain("Your output will differ");
});

/* ADR-0029. The note is the reader's only way to tell a command they would type from one that is on
 * the page to be checked, so both the marking and the link back to the example it stands for are
 * asserted rather than left to a screenshot. */
describe("exampleCard: a proof example", () => {
  const proof = example({ title: "Check it", proves: "Read the totals", output: "yes" });

  it("is marked, and says why it is there", async () => {
    const html = await card("sec", 2, proof, "sec-1");
    expect(html).toContain('class="example example-proof"');
    expect(html).toContain("Why this example is here:");
  });

  it("links to the example it stands for", async () => {
    const html = await card("sec", 2, proof, "sec-1");
    expect(html).toContain('<a href="#sec-1">“Read the totals”</a>');
  });

  it("puts the note before the description", async () => {
    const html = await card("sec", 2, proof, "sec-1");
    expect(html.indexOf("proof-note")).toBeLessThan(html.indexOf("example-desc"));
  });

  it("refuses to render without the anchor, rather than dropping the note", async () => {
    await expect(card("sec", 2, proof)).rejects.toThrow(/no anchor was passed/);
  });

  it("leaves an ordinary example unmarked", async () => {
    const html = await card("sec", 1, example({}));
    expect(html).not.toContain("proof");
  });
});
