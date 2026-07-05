import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { breadcrumbs } from "./partials/breadcrumbs.js";
import { tagChips } from "./partials/tagChips.js";
import { toc } from "./partials/toc.js";
import { exampleCard } from "./partials/exampleCard.js";
import type { TocEntry } from "../content/markdown.js";
import type { Page } from "../content/loader.js";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function commandPage(page: Page, cssHref: string): Promise<string> {
  const dateStr = page.updated.toISOString().slice(0, 10);
  const examplesFile = page.examples;
  if (!examplesFile) throw new Error(`commandPage: ${page.slug} has no examples`);

  const totalExamples = examplesFile.sections.reduce((n, s) => n + s.examples.length, 0);
  const roundedCount = Math.floor(totalExamples / 10) * 10;
  const countLabel = roundedCount > 0 ? `${roundedCount}+` : `${totalExamples}`;

  const sectionTocEntries: TocEntry[] = examplesFile.sections.map((s) => ({
    level: 2,
    id: slugify(s.title),
    text: s.title,
  }));

  const sectionsHtml = await Promise.all(
    examplesFile.sections.map(async (section) => {
      const sectionSlug = slugify(section.title);
      const cards = await Promise.all(section.examples.map((ex, i) => exampleCard(sectionSlug, i + 1, ex)));
      return html`<section class="example-section">
<h2 id="${sectionSlug}">${section.title}</h2>
${section.intro ? html`<p class="section-intro">${section.intro}</p>` : ""}
${cards.map((c) => raw(c))}
</section>`;
    }),
  );

  const relatedHtml = page.relatedLinks.length
    ? html`<nav class="related" aria-label="Related pages"><h2>Related</h2><ul>
${page.relatedLinks.map((r) => raw(html`<li><a href="${r.url}">${r.title}</a></li>`))}
</ul></nav>`
    : "";

  const body = html`
${raw(breadcrumbs(page.category, page.title))}
<article class="command-page">
<h1>${page.title}</h1>
<p class="tagline">${page.tagline}</p>
<p class="meta">Updated ${dateStr}</p>
${raw(tagChips(page.tags))}
${raw(toc([...page.toc, ...sectionTocEntries]))}
<div class="prose">${raw(page.html)}</div>
${sectionsHtml.map((s) => raw(s))}
${raw(relatedHtml)}
</article>`;

  return layout({
    title: `${page.title} — ${countLabel} practical examples`,
    description: page.description,
    path: page.url,
    activeCategory: page.category,
    bodyHtml: raw(body),
    cssHref,
    draft: page.draft,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: page.title,
      description: page.description,
      dateModified: dateStr,
    },
  });
}
