import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { pageCard } from "./partials/card.js";
import { type PageSlice, paginationNav } from "./partials/pager.js";
import { CATEGORY_META, COMMAND_GROUPS, COMMAND_GROUP_FALLBACK } from "../config.js";
import type { Page } from "../content/loader.js";
import type { Category } from "../content/schema.js";

/** The `/commands/` index, grouped by topic. Never paginated — see partials/pager.ts. */
function groupedCommands(pages: Page[]): string {
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const used = new Set<string>();
  const groups = COMMAND_GROUPS.map((g) => {
    const groupPages = g.commands.map((slug) => bySlug.get(slug)).filter((p): p is Page => Boolean(p));
    groupPages.forEach((p) => used.add(p.slug));
    return { title: g.title, pages: groupPages };
  }).filter((g) => g.pages.length > 0);

  const leftover = pages.filter((p) => !used.has(p.slug));
  if (leftover.length > 0) groups.push({ title: COMMAND_GROUP_FALLBACK, pages: leftover });

  return groups
    .map(
      (g) =>
        html`<section><h2>${g.title}</h2><div class="card-grid">${g.pages.map((p) => raw(pageCard(p)))}</div></section>`,
    )
    .join("");
}

export function listingPage(category: Category, slice: PageSlice<Page>, cssHref: string): string {
  const meta = CATEGORY_META[category];
  const contentHtml =
    category === "commands"
      ? groupedCommands(slice.items)
      : html`<div class="card-grid">${slice.items.map((p) => raw(pageCard(p, "h2")))}</div>`;

  const body = html`
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">${meta.label}</li></ol></nav>
<h1>${meta.label}</h1>
<p class="lede">${meta.description}</p>
${raw(contentHtml)}
${raw(paginationNav(slice))}
`;

  return layout({
    // A page-2 title that reads the same as page 1 is a duplicate as far as a search engine is
    // concerned, and unhelpful in a tab strip either way.
    title: slice.number === 1 ? meta.label : `${meta.label} — page ${slice.number}`,
    description: meta.description,
    path: slice.path,
    activeCategory: category,
    bodyHtml: raw(body),
    cssHref,
    ...(slice.prevPath ? { prevPath: slice.prevPath } : {}),
    ...(slice.nextPath ? { nextPath: slice.nextPath } : {}),
  });
}
