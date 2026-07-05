import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { pageCard } from "./partials/card.js";
import { CATEGORY_META, COMMAND_GROUPS, COMMAND_GROUP_FALLBACK } from "../config.js";
import type { Page } from "../content/loader.js";
import type { Category } from "../content/schema.js";

export function listingPage(category: Category, pages: Page[], cssHref: string): string {
  const meta = CATEGORY_META[category];
  let contentHtml: string;

  if (category === "commands") {
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    const used = new Set<string>();
    const groups = COMMAND_GROUPS.map((g) => {
      const groupPages = g.commands.map((slug) => bySlug.get(slug)).filter((p): p is Page => Boolean(p));
      groupPages.forEach((p) => used.add(p.slug));
      return { title: g.title, pages: groupPages };
    }).filter((g) => g.pages.length > 0);

    const leftover = pages.filter((p) => !used.has(p.slug));
    if (leftover.length > 0) groups.push({ title: COMMAND_GROUP_FALLBACK, pages: leftover });

    contentHtml = groups
      .map(
        (g) =>
          html`<section><h2>${g.title}</h2><div class="card-grid">${g.pages.map((p) => raw(pageCard(p)))}</div></section>`,
      )
      .join("");
  } else {
    contentHtml = html`<div class="card-grid">${pages.map((p) => raw(pageCard(p)))}</div>`;
  }

  const body = html`
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">${meta.label}</li></ol></nav>
<h1>${meta.label}</h1>
<p class="lede">${meta.description}</p>
${raw(contentHtml)}
`;

  return layout({
    title: meta.label,
    description: meta.description,
    path: meta.path,
    activeCategory: category,
    bodyHtml: raw(body),
    cssHref,
  });
}
