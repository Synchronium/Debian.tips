import { describe, expect, it } from "vitest";
import { highlightCode, renderMarkdown } from "../src/content/markdown.js";

describe("renderMarkdown", () => {
  it("assigns ids to h2/h3 headings and collects them in the toc", async () => {
    const { html, toc } = await renderMarkdown("## First section\n\ntext\n\n### A subsection\n");
    expect(html).toContain('id="first-section"');
    expect(html).toContain('id="a-subsection"');
    expect(toc).toEqual([
      { level: 2, id: "first-section", text: "First section" },
      { level: 3, id: "a-subsection", text: "A subsection" },
    ]);
  });

  it("wraps headings in an anchor link", async () => {
    const { html } = await renderMarkdown("## Hello\n");
    expect(html).toMatch(/<h2 id="hello"><a[^>]*class="heading-link"[^>]*>Hello<\/a><\/h2>/);
  });

  it("renders [!NOTE] blockquotes as callout asides", async () => {
    const { html } = await renderMarkdown("> [!NOTE]\n> Remember this.\n");
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('class="callout-label"');
    expect(html).toContain("Note");
    expect(html).toContain("Remember this.");
    expect(html).not.toContain("[!NOTE]");
  });

  it("renders [!WARNING] and [!DANGER] with distinct classes", async () => {
    const warning = await renderMarkdown("> [!WARNING]\n> Careful.\n");
    const danger = await renderMarkdown("> [!DANGER]\n> Destructive.\n");
    expect(warning.html).toContain('class="callout callout-warning"');
    expect(danger.html).toContain('class="callout callout-danger"');
  });

  it("leaves ordinary blockquotes untouched", async () => {
    const { html } = await renderMarkdown("> Just a quote.\n");
    expect(html).not.toContain("callout");
    expect(html).toContain("<blockquote>");
  });

  it("highlights fenced code blocks with Shiki dual-theme output", async () => {
    const { html } = await renderMarkdown('```bash\necho "hi"\n```\n');
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-dark");
    expect(html).toContain('aria-label="command"');
  });

  it("falls back to plaintext aria-label for fences with no language", async () => {
    const { html } = await renderMarkdown("```\nplain output\n```\n");
    expect(html).toContain('aria-label="output"');
  });

  it("falls back gracefully for a language Shiki does not bundle (sed -> bash)", async () => {
    const { html } = await renderMarkdown("```sed\ns/foo/bar/\n```\n");
    expect(html).toContain("shiki");
  });
});

describe("highlightCode", () => {
  it("produces dual-theme Shiki output for a standalone snippet", async () => {
    const out = await highlightCode('grep "x" file', "bash");
    expect(out).toContain("shiki");
    expect(out).toContain("--shiki-dark");
  });
});
