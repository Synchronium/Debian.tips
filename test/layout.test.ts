import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { layout, resetClientScripts } from "../src/templates/layout.js";
import { CLIENT_DIR } from "../src/paths.js";
import { raw } from "../src/html.js";

/* The layout is on every page, so anything wrong here is wrong everywhere at once, and two of
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
    // They have to run before first paint, which a <script src> cannot promise. Asserted on
    // strings the minifier cannot rename, since an identifier it is free to shorten would make this
    // a test of esbuild's output rather than of the layout.
    const html = render();
    expect(html).toContain("localStorage.getItem");
    expect(html).toContain("prefers-color-scheme: light");
    expect(html).toContain("data-search-open");
    expect(html).not.toContain('src="/assets/interaction.js"');
  });

  it("compiles every client script with the shared declarations", () => {
    // src/client/shared.ts is prepended rather than imported, because the two scripts are
    // inlined at different points in the document. If that stopped happening both would still
    // compile (as one TypeScript global scope, tsconfig.client.json typechecks them together)
    // and both would fail at runtime with the theme names undefined.
    // The IIFE wrapper is what `clientScript` adds, so it is what separates the two compiled
    // client scripts from the analytics snippet a production build also inlines.
    const scripts = [...render().matchAll(/<script>(.*?)<\/script>/gs)]
      .map((match) => match[1] ?? "")
      .filter((script) => script.startsWith("(()=>"));
    expect(scripts).toHaveLength(2);
    for (const script of scripts) expect(script).toContain('"data-theme"');
  });

  it("re-reads a client script after the cache is reset", () => {
    // The dev server builds many times in one process, and routes an edit under src/client/ to a
    // rebuild rather than a restart. Without the reset the rebuild emits the previous
    // compilation: it succeeds, reports its milliseconds, and changes nothing on the page, which
    // is a much worse way to find out than an error.
    const before = render();
    const file = join(CLIENT_DIR, "interaction.ts");
    const original = readFileSync(file, "utf-8");
    try {
      writeFileSync(file, `${original}\nconsole.log("cache-probe");\n`, "utf-8");
      expect(render()).toBe(before);
      resetClientScripts();
      expect(render()).toContain("cache-probe");
    } finally {
      writeFileSync(file, original, "utf-8");
      resetClientScripts();
    }
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

  it("uses a hyphen, not an em dash, in the title it assembles", () => {
    // voice.md bans the em dash and `npm run voice` cannot see this one: it reads whole-line
    // comments in a source file, and a separator in a template lives in a string literal. The
    // title is on every page on the site, so this is the assertion that stands in for the rule.
    expect(render({ title: "grep" })).toContain("<title>grep - debian.tips</title>");
    expect(render()).not.toContain("\u2014");
  });

  it("escapes a `<` in structured data so it cannot end the script element", () => {
    const html = render({ jsonLd: { headline: "</script><img>" } });
    expect(html).not.toContain("</script><img>");
    expect(html).toContain("\\u003c/script");
  });
});
