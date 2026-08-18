// Builds the editorial link graph over the loaded content: who links to whom, by
// `related:` frontmatter and by root-relative links in prose.
//
// Separate from scripts/link-audit.ts, which reports on it, because a false edge here is
// the one failure the report can't show you: a missed edge invents an orphan, which is
// noisy but visible, while an invented edge hides a real one under a clean bill of health.
// Covered by test/linkGraph.test.ts for that reason.
import type { Page } from "../../src/content/loader.js";

export type EdgeKind = "related" | "prose";

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

/** Root-relative links in a rendered prose body. Taken from the HTML rather than the
 *  Markdown so a link written any way the pipeline accepts is counted. Fragments are
 *  dropped: `#heading` addresses a place on a page, not a page. */
export function linksInHtml(html: string): string[] {
  return [...html.matchAll(/href="(\/[^"#]*)"/g)].map((match) => match[1]!);
}

/** Root-relative links in the short Markdown fields on a command page — example
 *  descriptions, section intros, fixture notes. These render through `renderInline()`,
 *  which drops raw HTML, so a Markdown link is the only form that can appear. */
export function linksInMarkdown(text: string): string[] {
  return [...text.matchAll(/\]\((\/[^)\s#]*)[^)]*\)/g)].map((match) => match[1]!);
}

/** Every root-relative link on a page, prose and examples alike. Returns URLs, which are
 *  resolved to slugs by `collectEdges`. */
export function proseLinkTargets(page: Page): string[] {
  const found = linksInHtml(page.html);
  for (const section of page.examples?.sections ?? []) {
    if (section.intro) found.push(...linksInMarkdown(section.intro));
    for (const example of section.examples) {
      found.push(...linksInMarkdown(example.description));
    }
  }
  for (const fixture of page.examples?.fixtures ?? []) {
    if (fixture.note) found.push(...linksInMarkdown(fixture.note));
  }
  return found;
}

export function collectEdges(pages: Page[]): Edge[] {
  const slugByUrl = new Map(pages.map((page) => [page.url, page.slug]));
  const edges: Edge[] = [];

  for (const page of pages) {
    for (const target of page.related) {
      edges.push({ from: page.slug, to: target, kind: "related" });
    }
    for (const url of proseLinkTargets(page)) {
      // A listing, a tag page or /about/ resolves to no content page, and a page linking
      // itself is not an edge. Whether these resolve at all is src/linkcheck.ts's job.
      const target = slugByUrl.get(url);
      if (target && target !== page.slug) edges.push({ from: page.slug, to: target, kind: "prose" });
    }
  }
  return edges;
}

/** Distinct link targets per page, and distinct sources per page. Both directions are
 *  deduplicated: a page linked twice from the same source has one route in, not two. */
export function adjacency(
  pages: Page[],
  edges: Edge[],
): {
  outbound: Map<string, Set<string>>;
  inbound: Map<string, Set<string>>;
} {
  const outbound = new Map(pages.map((page) => [page.slug, new Set<string>()]));
  const inbound = new Map(pages.map((page) => [page.slug, new Set<string>()]));
  for (const edge of edges) {
    outbound.get(edge.from)?.add(edge.to);
    inbound.get(edge.to)?.add(edge.from);
  }
  return { outbound, inbound };
}

/** How closely two pages are related, used only to rank suggestions: a pair sharing tags
 *  and a category is a likelier link than a pair sharing neither. */
export function affinity(a: Page, b: Page): number {
  const sharedTags = a.tags.filter((tag) => b.tags.includes(tag)).length;
  return sharedTags * 2 + (a.category === b.category ? 1 : 0);
}
