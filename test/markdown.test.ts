import { describe, expect, it } from "vitest";
import { highlightCode, renderInline, renderMarkdown } from "../src/content/markdown.js";
import { shikiStyleCss } from "../src/content/shikiStyles.js";

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
    expect(html).toContain('aria-label="command"');
    // The dual-theme colours are in the stylesheet now, one class per distinct pair of
    // declarations; see src/content/shikiStyles.ts and test/shikiStyles.test.ts. The markup
    // carries the class; the `--shiki-dark` custom property the dark theme reads is on the
    // rule, not on the element.
    expect(html).toMatch(/<span class="s[0-9a-f]{6}">/);
    expect(shikiStyleCss()).toContain("--shiki-dark");
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

describe("renderInline", () => {
  it("turns backticked spans into code elements", async () => {
    expect(await renderInline("`g` (global) replaces every match.", "ctx")).toBe(
      "<code>g</code> (global) replaces every match.",
    );
  });

  it("emits no wrapping paragraph", async () => {
    expect(await renderInline("Plain sentence.", "ctx")).not.toContain("<p>");
  });

  it("renders links and emphasis", async () => {
    expect(await renderInline("See [grep](/commands/grep/) for *more*.", "ctx")).toBe(
      'See <a href="/commands/grep/">grep</a> for <em>more</em>.',
    );
  });

  it("escapes HTML-significant characters in plain text", async () => {
    expect(await renderInline("< marks the old side, > the new.", "ctx")).toBe(
      "&#x3C; marks the old side, > the new.",
    );
  });

  it("escapes HTML-significant characters inside a code span", async () => {
    expect(await renderInline("`2>&1` redirects stderr.", "ctx")).toBe(
      "<code>2>&#x26;1</code> redirects stderr.",
    );
  });

  it("drops raw HTML tags rather than passing them through", async () => {
    // The tags go, their text content stays, so nothing is injected and nothing
    // vanishes so quietly that a mangled field would look fine in review.
    expect(await renderInline("Set <script>alert(1)</script> here.", "ctx")).toBe("Set alert(1) here.");
  });

  it("leaves an unpaired asterisk alone (cron fields, globs)", async () => {
    expect(await renderInline("Equivalent to 0 0 * * *: midnight.", "ctx")).toBe(
      "Equivalent to 0 0 * * *: midnight.",
    );
  });

  it("returns an empty string for blank input", async () => {
    expect(await renderInline("   ", "ctx")).toBe("");
  });

  // A block-level construct would put a <div>/<ul>/<pre> inside the <p> these fields
  // render into, which is invalid HTML that neither the schema nor linkcheck would catch.
  it("rejects block-level content, naming the field and the text", async () => {
    await expect(renderInline("- one\n- two", 'example "Sort by score"')).rejects.toThrow(
      /example "Sort by score": must be a single paragraph/,
    );
    await expect(renderInline("First para.\n\nSecond para.", "ctx")).rejects.toThrow(/single paragraph/);
  });
});

describe("highlightCode", () => {
  it("produces dual-theme Shiki output for a standalone snippet", async () => {
    const out = await highlightCode('grep "x" file', "bash");
    expect(out).toContain("shiki");
    expect(out).toMatch(/<span class="s[0-9a-f]{6}">/);
    expect(shikiStyleCss()).toContain("--shiki-dark");
  });
});
