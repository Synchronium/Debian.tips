import { html, raw, type Raw } from "../html.js";
import { layout } from "./layout.js";
import { isoDay, techArticleJsonLd } from "./pageMeta.js";
import { breadcrumbs } from "./partials/breadcrumbs.js";
import { tagChips } from "./partials/tagChips.js";
import { prevNext } from "./partials/prevNext.js";
import { related } from "./partials/related.js";
import { toc } from "./partials/toc.js";
import { sourceLinks } from "./partials/sourceLinks.js";
import type { ArticlePage, ScriptingPage } from "../content/loader.js";
import { SCRIPTING_CATEGORY } from "../content/schema.js";

export function articlePage(page: ArticlePage | ScriptingPage, cssHref: string): Raw {
  const dateStr = isoDay(page.updated);
  const series = page.category === SCRIPTING_CATEGORY ? prevNext(page.prev, page.next) : "";

  const body = html`
${breadcrumbs(page.category, page.title)}
<article class="article">
<div class="content">
<header class="page-head">
<h1>${page.title}</h1>
${page.tagline ? html`<p class="tagline">${page.tagline}</p>` : ""}
<p class="meta">Updated ${dateStr}</p>
${tagChips(page.tags)}
</header>
<div class="prose">${raw(page.html)}</div>
${related(page.relatedLinks)}
${series}
${sourceLinks(page.slug, page.sources, page.checks)}
</div>
${toc(page.toc)}
</article>`;

  return layout({
    title: page.title,
    description: page.description,
    path: page.url,
    activeCategory: page.category,
    bodyHtml: body,
    cssHref,
    draft: page.draft,
    indexable: true,
    ogType: "article",
    modified: dateStr,
    jsonLd: techArticleJsonLd(page),
  });
}
