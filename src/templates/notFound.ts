import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { CATEGORY_META, NAV_ORDER, NOT_FOUND_PATH } from "../config.js";

export function notFoundPage(cssHref: string): string {
  const categoryLinks = NAV_ORDER.map((cat) =>
    raw(html`<li><a href="${CATEGORY_META[cat].path}">${CATEGORY_META[cat].label}</a></li>`),
  );

  const body = html`
<header class="page-head">
<h1>Page not found</h1>
<p class="lede">The page you're looking for doesn't exist or has moved. Try searching for it, or
browse a category below.</p>
</header>
<button type="button" class="search-field" data-search-open aria-haspopup="dialog" aria-controls="search-dialog">
<span aria-hidden="true" class="search-trigger-icon">⌕</span>
<span>Search commands and topics…</span>
</button>
<ul class="browse-categories">${categoryLinks}</ul>`;

  return layout({
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has moved.",
    path: NOT_FOUND_PATH,
    bodyHtml: raw(body),
    cssHref,
  });
}
