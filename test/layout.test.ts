import { describe, expect, it } from "vitest";
import { layout } from "../src/templates/layout.js";
import { raw } from "../src/html.js";

/* The layout is on every page, so anything wrong here is wrong everywhere at once — and two of
 * the things it does are invisible until they are wrong in production: it inlines client
 * JavaScript read from src/client/, and it only emits analytics in a production build. */

function render(overrides: Partial<Parameters<typeof layout>[0]> = {}): string {
  return layout({
    title: "A page",
    description: "A description.",
    path: "/concepts/pipes/",
    bodyHtml: raw("<p>body</p>"),
    cssHref: "/assets/site.abc123.css",
    ...overrides,
  });
}

function withNodeEnv(value: string | undefined, body: () => void): void {
  const previous = process.env["NODE_ENV"];
  if (value === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = value;
  try {
    body();
  } finally {
    if (previous === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = previous;
  }
}

describe("layout", () => {
  it("inlines the client scripts rather than linking them", () => {
    // They have to run before first paint, which a <script src> cannot promise.
    const html = render();
    expect(html).toContain('localStorage.getItem("theme")');
    expect(html).toContain("data-search-open");
    expect(html).not.toContain('src="/assets/interaction.js"');
  });

  it("keeps analytics out of a development build", () => {
    withNodeEnv(undefined, () => {
      expect(render()).not.toContain("googletagmanager");
    });
  });

  it("emits analytics in a production build", () => {
    withNodeEnv("production", () => {
      expect(render()).toContain("googletagmanager");
    });
  });

  it("declares a content page as an article, and everything else as a website", () => {
    expect(render({ ogType: "article", modified: "2026-08-17" })).toContain(
      '<meta property="og:type" content="article" />',
    );
    expect(render({ ogType: "article", modified: "2026-08-17" })).toContain(
      '<meta property="article:modified_time" content="2026-08-17" />',
    );
    expect(render()).toContain('<meta property="og:type" content="website" />');
  });

  it("links a paginated listing's neighbours", () => {
    const html = render({ prevPath: "/tags/apt/", nextPath: "/tags/apt/page/3/" });
    expect(html).toContain('<link rel="prev" href="https://debian.tips/tags/apt/" />');
    expect(html).toContain('<link rel="next" href="https://debian.tips/tags/apt/page/3/" />');
    expect(render()).not.toContain('rel="prev"');
  });

  it("marks only indexable pages for Pagefind", () => {
    // Pagefind indexes solely inside data-pagefind-body once it appears anywhere on the site,
    // so a listing page carrying it by accident would put listings into the results.
    expect(render({ indexable: true })).toContain('<main id="main" data-pagefind-body>');
    expect(render()).toContain('<main id="main">');
  });

  it("escapes a `<` in structured data so it cannot end the script element", () => {
    const html = render({ jsonLd: { headline: "</script><img>" } });
    expect(html).not.toContain("</script><img>");
    expect(html).toContain("\\u003c/script");
  });
});
