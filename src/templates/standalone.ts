import { html, raw, type Raw } from "../html.js";
import { layout } from "./layout.js";
import { toc } from "./partials/toc.js";
import type { TocEntry } from "../content/markdown.js";

export interface StandalonePage {
  title: string;
  description: string;
  path: string;
  html: string;
  toc: TocEntry[];
}

/** A page that belongs to no category: no breadcrumbs, no tags, no prev/next, and absent
 *  from the listings and the tag index. Currently just /about/. */
export function standalonePage(page: StandalonePage, cssHref: string): Raw {
  const body = html`
<article class="article">
<div class="content">
<h1>${page.title}</h1>
<div class="prose">${raw(page.html)}</div>
</div>
${toc(page.toc)}
</article>`;

  return layout({
    title: page.title,
    description: page.description,
    path: page.path,
    bodyHtml: body,
    cssHref,
    indexable: true,
  });
}
