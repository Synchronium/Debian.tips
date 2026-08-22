import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { pageCard } from "./partials/card.js";
import { CATEGORY_META, FEATURED_PATHS, NAV_ORDER, SITE, STANDALONE_PAGES } from "../config.js";
import { type Page, isCommandPage } from "../content/loader.js";
import type { Tier } from "../content/schema.js";

/** Homepage ordering, in priority order: flagship command pages first, then most
 * recently updated. `pages` arrives sorted by slug, so without this the preview would
 * be the alphabetically-first six forever, and new content would never reach the homepage,
 * and on /commands/ the big reference pages (grep, find, sed) would be crowded out by
 * whatever happens to sort early. Only categories with more than six pages actually
 * truncate; for the rest this just reorders. */
const TIER_RANK: Record<Tier, number> = { flagship: 0, standard: 1, light: 2 };

/** Pages with no tier (everything but a command page) sort after every tiered one, on date. */
const UNTIERED_RANK = Object.keys(TIER_RANK).length;

function homepageOrder(a: Page, b: Page): number {
  const rank = (p: Page): number => (isCommandPage(p) ? TIER_RANK[p.tier] : UNTIERED_RANK);
  return rank(a) - rank(b) || b.updated.getTime() - a.updated.getTime();
}

/** How many cards each category shows on the homepage before "see all". Small on purpose: the
 *  homepage is a table of contents, not a listing. `PAGE_SIZE` in partials/pager.ts is the
 *  number for pages whose job is to list things. */
const HOME_CARDS_PER_CATEGORY = 6;

export function homePage(pages: Page[], cssHref: string): string {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const featured = FEATURED_PATHS.map((u) => byUrl.get(u)).filter((p): p is Page => Boolean(p));

  const sections = NAV_ORDER.map((cat) => {
    const catPages = pages
      .filter((p) => p.category === cat)
      .sort(homepageOrder)
      .slice(0, HOME_CARDS_PER_CATEGORY);
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
    ? raw(
        html`<section class="start-here"><h2>Start here</h2><div class="card-grid">${featured.map((p) => raw(pageCard(p)))}</div></section>`,
      )
    : ""
}
${sections.map((s) => raw(s))}
<section class="tested">
<h2>Every example here was run, not remembered</h2>
<p>Command references drift: the distribution moves on, output changes, and prose written from
memory quietly stops being true. Every example on this site is run inside a throwaway Debian
container, and what you see is what it printed. They are re-run on every change, and a page whose
output no longer matches fails the build.</p>
${STANDALONE_PAGES.map((s) => raw(html`<p><a href="${s.path}">${s.navLabel}</a></p>`))}
</section>
`;

  return layout({
    title: SITE.title,
    description: SITE.description,
    path: "/",
    bodyHtml: raw(body),
    cssHref,
  });
}
