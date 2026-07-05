import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { CATEGORY_META, NAV_ORDER } from "../config.js";

export function notFoundPage(cssHref: string): string {
  const categoryLinks = NAV_ORDER.map(
    (cat) => raw(html`<li><a href="${CATEGORY_META[cat].path}">${CATEGORY_META[cat].label}</a></li>`),
  );

  const body = html`
<h1>Page not found</h1>
<p>The page you're looking for doesn't exist or has moved. Try searching for it, or
browse a category below.</p>
<p><button type="button" class="button" data-search-open>Search debian.tips</button></p>
<ul class="tags">${categoryLinks}</ul>`;

  return layout({
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has moved.",
    path: "/404.html",
    bodyHtml: raw(body),
    cssHref,
  });
}
