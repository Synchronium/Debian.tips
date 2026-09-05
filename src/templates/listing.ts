import { html, type Raw } from "../html.js";
import { layout } from "./layout.js";
import { rowList } from "./partials/row.js";
import { type PageSlice, paginationNav } from "./partials/pager.js";
import { CATEGORY_META, COMMAND_GROUPS, COMMAND_GROUP_FALLBACK } from "../config.js";
import type { Page } from "../content/loader.js";
import { COMMANDS_CATEGORY, type Category } from "../content/schema.js";

/** Filters the rows already on the page, by title and description.
 *
 *  A listing is the one place a reader arrives knowing roughly what they want, and typing three
 *  letters beats reading down the topic groups. It filters what the page already contains rather
 *  than querying the search index, so it costs no request and cannot disagree with the listing
 *  it sits above; site-wide search is still the dialog in the header.
 *
 *  Scripted, so `styles/site.css` hides it when JS is not running. The listing below it is
 *  complete either way, so nothing is lost with it. */
function listingFilter(label: string): Raw {
  return html`<div class="listing-filter" data-pagefind-ignore>
<label class="visually-hidden" for="listing-filter-input">Filter ${label.toLowerCase()}</label>
<span aria-hidden="true" class="search-trigger-icon">⌕</span>
<input type="search" id="listing-filter-input" data-listing-filter placeholder="Filter ${label.toLowerCase()}…" autocomplete="off" spellcheck="false" />
</div>
<p class="visually-hidden" role="status" data-listing-filter-status></p>`;
}

/** The `/commands/` index, grouped by topic. Never paginated; see partials/pager.ts. */
function groupedCommands(pages: Page[]): Raw {
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const used = new Set<string>();
  const groups = COMMAND_GROUPS.map((g) => {
    const groupPages = g.commands.map((slug) => bySlug.get(slug)).filter((p): p is Page => Boolean(p));
    groupPages.forEach((p) => used.add(p.slug));
    return { title: g.title, pages: groupPages };
  }).filter((g) => g.pages.length > 0);

  const leftover = pages.filter((p) => !used.has(p.slug));
  if (leftover.length > 0) groups.push({ title: COMMAND_GROUP_FALLBACK, pages: leftover });

  return html`${groups.map(
    (g) => html`<section class="listing-group"><h2>${g.title}</h2>${rowList(g.pages)}</section>`,
  )}`;
}

export function listingPage(category: Category, slice: PageSlice<Page>, cssHref: string): Raw {
  const meta = CATEGORY_META[category];
  const contentHtml =
    category === COMMANDS_CATEGORY ? groupedCommands(slice.items) : rowList(slice.items, "h2");

  const body = html`
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">${meta.label}</li></ol></nav>
<header class="page-head">
<h1>${meta.label}</h1>
<p class="lede">${meta.description}</p>
</header>
${listingFilter(meta.label)}
${contentHtml}
<p class="listing-empty" hidden>Nothing on this page matches that. Try the site search for everything else.</p>
${paginationNav(slice)}
`;

  return layout({
    // A page-2 title that reads the same as page 1 is a duplicate as far as a search engine is
    // concerned, and unhelpful in a tab strip either way.
    title: slice.number === 1 ? meta.label : `${meta.label} - page ${slice.number}`,
    description: meta.description,
    path: slice.path,
    activeCategory: category,
    bodyHtml: body,
    cssHref,
    ...(slice.prevPath ? { prevPath: slice.prevPath } : {}),
    ...(slice.nextPath ? { nextPath: slice.nextPath } : {}),
  });
}
