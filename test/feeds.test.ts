import { describe, expect, it } from "vitest";
import { feedXml, sitemapXml } from "../src/feeds.js";
import type { ArticlePage, Page } from "../src/content/loader.js";

/* Both outputs are XML built by string concatenation, and both are consumed by machines that
 * fail quietly: a feed reader drops a malformed entry, a crawler ignores a malformed sitemap.
 * Nothing here asserted more than "the root element exists" before. */

function page(slug: string, overrides: Partial<ArticlePage> = {}): ArticlePage {
  return {
    category: "concepts",
    slug,
    url: `/concepts/${slug}/`,
    title: slug,
    description: `About ${slug}.`,
    tags: ["demo"],
    updated: new Date("2026-08-17T00:00:00Z"),
    related: [],
    relatedLinks: [],
    draft: false,
    html: "",
    toc: [],
    sources: { files: [], replayable: false },
    ...overrides,
  };
}

describe("sitemapXml", () => {
  const pages: Page[] = [
    page("pipes", { updated: new Date("2026-08-01T00:00:00Z") }),
    page("quoting", { updated: new Date("2026-08-17T00:00:00Z") }),
  ];

  it("lists the home page, the listings it is given, the standalone pages and every page", () => {
    const xml = sitemapXml(pages, [{ path: "/concepts/", pages }]);
    for (const path of ["/", "/concepts/", "/about/", "/concepts/pipes/", "/concepts/quoting/"]) {
      expect(xml).toContain(`<loc>https://debian.tips${path}</loc>`);
    }
  });

  it("lists a paginated listing's every page, because the build emitted every one", () => {
    const xml = sitemapXml(pages, [
      { path: "/concepts/", pages: [pages[0]!] },
      { path: "/concepts/page/2/", pages: [pages[1]!] },
    ]);
    expect(xml).toContain("<loc>https://debian.tips/concepts/page/2/</loc>");
  });

  it("dates a listing by the newest page on it", () => {
    const xml = sitemapXml(pages, [{ path: "/concepts/", pages }]);
    expect(xml).toContain("<loc>https://debian.tips/concepts/</loc><lastmod>2026-08-17</lastmod>");
  });

  it("escapes a path that would otherwise break the document", () => {
    const xml = sitemapXml([page("a&b")], []);
    expect(xml).toContain("/concepts/a&amp;b/");
    expect(xml).not.toContain("/concepts/a&b/");
  });

  it("omits lastmod for a listing with no pages rather than inventing a date", () => {
    const xml = sitemapXml(pages, [{ path: "/empty/", pages: [] }]);
    expect(xml).toContain("<url><loc>https://debian.tips/empty/</loc></url>");
  });
});

describe("feedXml", () => {
  it("orders entries newest first", () => {
    const xml = feedXml([
      page("older", { updated: new Date("2026-01-01T00:00:00Z") }),
      page("newer", { updated: new Date("2026-08-17T00:00:00Z") }),
    ]);
    expect(xml.indexOf("<title>newer</title>")).toBeLessThan(xml.indexOf("<title>older</title>"));
  });

  it("caps the feed at twenty entries", () => {
    const many = Array.from({ length: 30 }, (_unused, i) => page(`page-${i}`));
    expect([...feedXml(many).matchAll(/<entry>/g)]).toHaveLength(20);
  });

  it("escapes titles and descriptions", () => {
    const xml = feedXml([page("x", { title: "a & b", description: "<not markup>" })]);
    expect(xml).toContain("<title>a &amp; b</title>");
    expect(xml).toContain("<summary>&lt;not markup&gt;</summary>");
  });

  it("still produces a valid feed with no pages at all", () => {
    const xml = feedXml([]);
    expect(xml).toContain("<feed xmlns=");
    expect(xml).toContain("<updated>1970-01-01T00:00:00.000Z</updated>");
    expect(xml).not.toContain("<entry>");
  });
});
