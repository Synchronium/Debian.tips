import { describe, expect, it } from "vitest";
import type { ArticlePage, CommandPage } from "../src/content/loader.js";
import {
  adjacency,
  affinity,
  collectEdges,
  linksInHtml,
  linksInMarkdown,
  proseLinkTargets,
} from "../scripts/lib/linkGraph.js";

/* The graph behind `npm run audit:links`. A missed edge invents an orphan, which is noisy
 * but visible; an invented edge hides a real orphan behind a clean report, which is not.
 * These cases pin the second kind down. */

/** A command page, since that is the shape carrying examples — the interesting case for the
 *  graph, which reads links out of example descriptions as well as out of prose. */
function page(overrides: Partial<CommandPage> & Pick<CommandPage, "slug">): CommandPage {
  return {
    category: "commands",
    url: `/commands/${overrides.slug}/`,
    title: overrides.slug,
    description: "",
    tags: [],
    updated: new Date("2026-08-17"),
    related: [],
    relatedLinks: [],
    draft: false,
    html: "",
    toc: [],
    sources: { files: [], replayable: false },
    tagline: "",
    tier: "standard",
    examples: { command: overrides.slug, sections: [] },
    ...overrides,
  };
}

/** A page in a category other than `commands`, for the cases that care about two pages
 *  sharing a slug or a category boundary. */
function article(slug: string, category: ArticlePage["category"], tags: string[] = []): ArticlePage {
  return {
    category,
    slug,
    url: `/${category}/${slug}/`,
    title: slug,
    description: "",
    tags,
    updated: new Date("2026-08-17"),
    related: [],
    relatedLinks: [],
    draft: false,
    html: "",
    toc: [],
    sources: { files: [], replayable: false },
  };
}

describe("linksInHtml", () => {
  it("takes root-relative hrefs and ignores everything else", () => {
    const html = `<a href="/commands/grep/">grep</a> <a href="https://example.com">out</a>
      <a href="../relative/">rel</a> <a href="/concepts/pipes-and-redirection/">pipes</a>`;
    expect(linksInHtml(html)).toEqual(["/commands/grep/", "/concepts/pipes-and-redirection/"]);
  });

  it("ignores the heading anchors rehype-autolink-headings adds", () => {
    // Every `##` on every page emits one. Counting them as edges would make each page link
    // to itself and mask a genuine orphan, since a self-link reads as an inbound link.
    expect(linksInHtml('<h2 id="flags"><a href="#flags">Flags</a></h2>')).toEqual([]);
  });
});

describe("linksInMarkdown", () => {
  it("takes root-relative Markdown links", () => {
    expect(linksInMarkdown("See [grep](/commands/grep/) and [sed](/commands/sed/).")).toEqual([
      "/commands/grep/",
      "/commands/sed/",
    ]);
  });

  it("strips a fragment and a link title from the target", () => {
    expect(linksInMarkdown('[flags](/commands/grep/#flags) [x](/commands/sed/ "the sed page")')).toEqual([
      "/commands/grep/",
      "/commands/sed/",
    ]);
  });

  it("ignores external and relative targets", () => {
    expect(linksInMarkdown("[repo](https://github.com/x) [sibling](../sed/)")).toEqual([]);
  });
});

describe("proseLinkTargets", () => {
  it("reads example descriptions, section intros and fixture notes as well as the body", () => {
    const target = proseLinkTargets(
      page({
        slug: "wc",
        html: '<a href="/commands/grep/">grep</a>',
        examples: {
          command: "wc",
          fixtures: [{ name: "report.txt", content: "x", note: "made by [find](/commands/find/)" }],
          sections: [
            {
              title: "Counting",
              intro: "pairs with [sort](/commands/sort/)",
              examples: [
                {
                  title: "Count lines",
                  code: "wc -l report.txt",
                  description: "like [cut](/commands/cut/)",
                  level: "basic",
                },
              ],
            },
          ],
        },
      }),
    );
    expect(target).toEqual(["/commands/grep/", "/commands/sort/", "/commands/cut/", "/commands/find/"]);
  });
});

describe("collectEdges", () => {
  const pages = [
    page({ slug: "grep", relatedLinks: [{ url: "/commands/sed/", title: "sed" }] }),
    page({ slug: "sed", html: '<a href="/commands/grep/">grep</a>' }),
    page({ slug: "wc", html: '<a href="/commands/wc/">self</a> <a href="/tags/search/">tag</a>' }),
  ];

  it("records related: and prose links as distinct kinds", () => {
    expect(collectEdges(pages)).toEqual([
      { from: "/commands/grep/", to: "/commands/sed/", kind: "related" },
      { from: "/commands/sed/", to: "/commands/grep/", kind: "prose" },
    ]);
  });

  it("drops a self-link and a link to a page that is not content", () => {
    // /tags/ and /about/ are real URLs with no page in the model; a self-link would give a
    // page an inbound link from itself and quietly rescue it from the orphan list.
    const wcEdges = collectEdges(pages).filter((edge) => edge.from === "/commands/wc/");
    expect(wcEdges).toEqual([]);
  });

  it("keeps two pages that share a slug apart", () => {
    // A slug is not a page's identity: `commands/find` and `recipes/find` are different pages,
    // and a graph keyed by slug would hand one page's inbound links to the other.
    const shared = [
      page({ slug: "find", html: '<a href="/recipes/find/">the recipe</a>' }),
      article("find", "recipes"),
    ];
    expect(collectEdges(shared)).toEqual([{ from: "/commands/find/", to: "/recipes/find/", kind: "prose" }]);
  });
});

describe("adjacency", () => {
  it("counts two links from the same page as one route in", () => {
    const pages = [
      page({
        slug: "wc",
        relatedLinks: [{ url: "/commands/grep/", title: "grep" }],
        html: '<a href="/commands/grep/">again</a>',
      }),
      page({ slug: "grep" }),
    ];
    const edges = collectEdges(pages);
    expect(edges).toHaveLength(2);
    expect(adjacency(pages, edges).inbound.get("/commands/grep/")).toEqual(new Set(["/commands/wc/"]));
  });
});

describe("affinity", () => {
  it("ranks shared tags above a shared category", () => {
    const a = page({ slug: "a", tags: ["files", "search"] });
    const sameCategory = page({ slug: "b", tags: ["networking"] });
    const sharedTag = article("c", "recipes", ["files"]);
    expect(affinity(a, sharedTag)).toBeGreaterThan(affinity(a, sameCategory));
  });

  it("is zero for pages with nothing in common", () => {
    const a = page({ slug: "a", tags: ["files"] });
    const b = article("b", "concepts", ["networking"]);
    expect(affinity(a, b)).toBe(0);
  });
});
