import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { breadcrumbs } from "./partials/breadcrumbs.js";
import { tagChips } from "./partials/tagChips.js";
import { toc } from "./partials/toc.js";
import { exampleCard } from "./partials/exampleCard.js";
import { highlightCode, type TocEntry } from "../content/markdown.js";
import type { Page } from "../content/loader.js";
import type { ExamplesFile } from "../content/schema.js";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Collapsed by default: useful when an output can't be interpreted without seeing its
 * input, but noise for a reader who already knows the data or is skimming for a flag. */
async function fixturesHtml(examplesFile: ExamplesFile): Promise<string> {
  const fixtures = examplesFile.fixtures ?? [];
  if (fixtures.length === 0) return "";

  const blocks = await Promise.all(
    fixtures.map(async (fixture) => {
      const body = await highlightCode(fixture.content, "plaintext");
      return html`<div class="fixture">
<p class="fixture-name"><code>${fixture.name}</code>${fixture.note ? raw(html` <span class="fixture-note">${fixture.note}</span>`) : ""}</p>
${raw(body)}
</div>`;
    }),
  );

  return html`<details class="fixtures">
<summary>Sample files used on this page</summary>
<p class="fixtures-intro">Every example below was run against these files. Recreate them to follow along.</p>
${blocks.map((b) => raw(b))}
</details>`;
}

export async function commandPage(page: Page, cssHref: string): Promise<string> {
  const dateStr = page.updated.toISOString().slice(0, 10);
  const examplesFile = page.examples;
  if (!examplesFile) throw new Error(`commandPage: ${page.slug} has no examples`);

  // Round down to the nearest ten and mark it "+", but only when there really are
  // extras — exactly 50 examples should read "50", not "50+".
  const totalExamples = examplesFile.sections.reduce((n, s) => n + s.examples.length, 0);
  const roundedCount = Math.floor(totalExamples / 10) * 10;
  const countLabel =
    roundedCount === 0 || roundedCount === totalExamples ? `${totalExamples}` : `${roundedCount}+`;

  const sectionTocEntries: TocEntry[] = examplesFile.sections.map((s) => ({
    level: 2,
    id: slugify(s.title),
    text: s.title,
  }));

  // Seeded with the prose heading ids the markdown pipeline already emitted, because
  // section titles and `##` headings in index.md land in the same document and are
  // slugged by two different functions (slugify here, rehype-slug there). A collision
  // between the two is invalid HTML and makes the section unreachable by anchor — the
  // TOC renders two entries pointing at the same target.
  const seenSectionSlugs = new Set<string>(page.toc.map((entry) => entry.id));
  const sectionsHtml = await Promise.all(
    examplesFile.sections.map(async (section) => {
      const sectionSlug = slugify(section.title);
      if (seenSectionSlugs.has(sectionSlug)) {
        throw new Error(
          `${page.slug}: section title "${section.title}" produces heading id "${sectionSlug}", which is already used on this page (by another section, or by a "##" heading in index.md) — rename one`,
        );
      }
      seenSectionSlugs.add(sectionSlug);
      const cards = await Promise.all(section.examples.map((ex, i) => exampleCard(sectionSlug, i + 1, ex)));
      return html`<section class="example-section">
<h2 id="${sectionSlug}">${section.title}</h2>
${section.intro ? raw(html`<p class="section-intro">${section.intro}</p>`) : ""}
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
<div class="content">
<h1>${page.title}</h1>
<p class="tagline">${page.tagline}</p>
<p class="meta">Updated ${dateStr}</p>
${raw(tagChips(page.tags))}
<div class="prose">${raw(page.html)}</div>
${raw(await fixturesHtml(examplesFile))}
${sectionsHtml.map((s) => raw(s))}
${raw(relatedHtml)}
</div>
${raw(toc([...page.toc, ...sectionTocEntries]))}
</article>`;

  return layout({
    title: `${page.title} — ${countLabel} practical examples`,
    description: page.description,
    path: page.url,
    activeCategory: page.category,
    bodyHtml: raw(body),
    cssHref,
    draft: page.draft,
    indexable: true,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: page.title,
      description: page.description,
      dateModified: dateStr,
    },
  });
}
