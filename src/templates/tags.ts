import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { pageCard } from "./partials/card.js";
import type { Page, TagInfo } from "../content/loader.js";

export function tagsIndexPage(tags: TagInfo[], pages: Page[], cssHref: string): string {
  const countByTag = new Map<string, number>();
  for (const p of pages) for (const t of p.tags) countByTag.set(t, (countByTag.get(t) ?? 0) + 1);

  const body = html`
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Tags</li></ol></nav>
<h1>Tags</h1>
<ul class="tag-index">
${tags.map(
  (t) =>
    raw(html`<li><a href="/tags/${t.name}/">${t.name}</a> <span class="tag-count">(${countByTag.get(t.name) ?? 0})</span> — ${t.description}</li>`),
)}
</ul>`;

  return layout({
    title: "Tags",
    description: "Browse every topic covered on debian.tips.",
    path: "/tags/",
    bodyHtml: raw(body),
    cssHref,
  });
}

export function tagPage(tag: TagInfo, pages: Page[], cssHref: string): string {
  const body = html`
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/tags/">Tags</a></li><li aria-current="page">${tag.name}</li></ol></nav>
<h1>${tag.name}</h1>
<p class="lede">${tag.description}</p>
<div class="card-grid">${pages.map((p) => raw(pageCard(p, "h2")))}</div>`;

  return layout({
    title: tag.name,
    description: `Everything tagged "${tag.name}" on debian.tips.`,
    path: `/tags/${tag.name}/`,
    bodyHtml: raw(body),
    cssHref,
  });
}
