import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { rowList } from "./partials/row.js";
import { iconSprite, icon } from "./partials/icons.js";
import { FEATURED_PATHS, HOME_TOPICS, SITE, STANDALONE_PAGES, tagPath } from "../config.js";
import { type Page, isCommandPage } from "../content/loader.js";
import type { Tier } from "../content/schema.js";

/** Ordering for the "recently updated" list, in priority order: flagship command pages first,
 * then most recently updated. `pages` arrives sorted by slug, so without this the list would be
 * the alphabetically-first few forever, and new content would never reach the homepage. */
const TIER_RANK: Record<Tier, number> = { flagship: 0, standard: 1, light: 2 };

/** Pages with no tier (everything but a command page) sort after every tiered one, on date. */
const UNTIERED_RANK = Object.keys(TIER_RANK).length;

function homepageOrder(a: Page, b: Page): number {
  const rank = (p: Page): number => (isCommandPage(p) ? TIER_RANK[p.tier] : UNTIERED_RANK);
  return rank(a) - rank(b) || b.updated.getTime() - a.updated.getTime();
}

/** How many pages the "recently updated" list shows.
 *
 *  A fixed number, so the homepage does not grow with the site: a section per category gets
 *  longer every time anything ships, and at the size the content roadmap is aiming at that is
 *  unreadable. A front door needs a way in by subject, a few hand-picked starting points, and
 *  evidence the site is alive. All three are fixed-size, and browsing belongs on the listings. */
const RECENT_COUNT = 8;

export function homePage(pages: Page[], cssHref: string): string {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const featured = FEATURED_PATHS.map((u) => byUrl.get(u)).filter((p): p is Page => Boolean(p));
  const recent = [...pages].sort(homepageOrder).slice(0, RECENT_COUNT);

  const topics = HOME_TOPICS.map((t) =>
    raw(html`<li class="topic"><a href="${tagPath(t.tag)}">
<span class="topic-icon" aria-hidden="true">${raw(icon(t.icon))}</span>
<span class="topic-text">
<span class="topic-label">${t.label}</span>
<span class="topic-desc">${t.description}</span>
</span>
</a></li>`),
  );

  const body = html`
${raw(iconSprite())}
<section class="hero">
<h1>${SITE.headline}</h1>
<p class="hero-tagline">${SITE.description}</p>
<button type="button" class="search-field" data-search-open aria-haspopup="dialog" aria-controls="search-dialog">
<span aria-hidden="true" class="search-trigger-icon">⌕</span>
<span>Search commands and topics…</span>
<kbd class="search-trigger-kbd" aria-hidden="true">⌘K</kbd>
</button>
</section>

<section class="home-section" aria-labelledby="browse-by-topic">
<h2 id="browse-by-topic" class="eyebrow">Browse by topic</h2>
<ul class="topic-grid">${topics}</ul>
</section>

${
  featured.length > 0
    ? raw(html`<section class="home-section" aria-labelledby="start-here">
<h2 id="start-here" class="eyebrow">Start here</h2>
${raw(rowList(featured))}
</section>`)
    : ""
}

<section class="home-section" aria-labelledby="recently-updated">
<h2 id="recently-updated" class="eyebrow">Recently updated</h2>
${raw(rowList(recent))}
</section>

<section class="tested">
<h2>Every example here was run, not remembered</h2>
<p>Command references drift: the distribution moves on, output changes, and prose written from
memory quietly stops being true. Every example on this site is run inside a throwaway Debian
container, and what you see is what it printed. They are re-run on every change, and a page whose
output no longer matches fails the build.</p>
${STANDALONE_PAGES.map((s) => raw(html`<p class="tested-more"><a href="${s.path}">${s.navLabel} →</a></p>`))}
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
