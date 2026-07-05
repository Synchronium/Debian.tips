import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { pageCard } from "./partials/card.js";
import { CATEGORY_META, FEATURED_PATHS, NAV_ORDER, SITE } from "../config.js";
import type { Page } from "../content/loader.js";

export function homePage(pages: Page[], cssHref: string): string {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const featured = FEATURED_PATHS.map((u) => byUrl.get(u)).filter((p): p is Page => Boolean(p));

  const sections = NAV_ORDER.map((cat) => {
    const catPages = pages.filter((p) => p.category === cat).slice(0, 6);
    if (catPages.length === 0) return "";
    return html`<section class="home-category">
<h2><a href="${CATEGORY_META[cat].path}">${CATEGORY_META[cat].label}</a></h2>
<div class="card-grid">${catPages.map((p) => raw(pageCard(p)))}</div>
</section>`;
  }).filter((s) => s !== "");

  const body = html`
<section class="hero">
<h1>${SITE.title}</h1>
<p class="hero-tagline">${SITE.description}</p>
<div class="hero-cta">
<a class="button" href="/commands/">Browse commands</a>
<a class="button button-secondary" href="/scripting/">Learn bash scripting</a>
</div>
</section>
${
  featured.length > 0
    ? raw(html`<section class="start-here"><h2>Start here</h2><div class="card-grid">${featured.map((p) => raw(pageCard(p)))}</div></section>`)
    : ""
}
${sections.map((s) => raw(s))}
`;

  return layout({ title: SITE.title, description: SITE.description, path: "/", bodyHtml: raw(body), cssHref });
}
