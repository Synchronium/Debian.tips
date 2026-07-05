import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { breadcrumbs } from "./partials/breadcrumbs.js";
import { tagChips } from "./partials/tagChips.js";
import { prevNext } from "./partials/prevNext.js";
import { toc } from "./partials/toc.js";
import type { Page } from "../content/loader.js";

export function articlePage(page: Page, cssHref: string): string {
  const dateStr = page.updated.toISOString().slice(0, 10);

  const relatedHtml = page.relatedLinks.length
    ? html`<nav class="related" aria-label="Related pages"><h2>Related</h2><ul>
${page.relatedLinks.map((r) => raw(html`<li><a href="${r.url}">${r.title}</a></li>`))}
</ul></nav>`
    : "";

  const body = html`
${raw(breadcrumbs(page.category, page.title))}
<article class="article">
<h1>${page.title}</h1>
<p class="meta">Updated ${dateStr}</p>
${raw(tagChips(page.tags))}
${raw(toc(page.toc))}
<div class="prose">${raw(page.html)}</div>
${raw(relatedHtml)}
${raw(prevNext(page.prev, page.next))}
</article>`;

  return layout({
    title: page.title,
    description: page.description,
    path: page.url,
    activeCategory: page.category,
    bodyHtml: raw(body),
    cssHref,
    draft: page.draft,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: page.title,
      description: page.description,
      dateModified: dateStr,
    },
  });
}
