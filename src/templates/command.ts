import GithubSlugger from "github-slugger";
import { html, raw } from "../html.js";
import { layout } from "./layout.js";
import { isoDay, techArticleJsonLd } from "./pageMeta.js";
import { breadcrumbs } from "./partials/breadcrumbs.js";
import { tagChips } from "./partials/tagChips.js";
import { related } from "./partials/related.js";
import { toc } from "./partials/toc.js";
import { exampleCard } from "./partials/exampleCard.js";
import { sourceLinks } from "./partials/sourceLinks.js";
import { highlightCode, renderInline, type TocEntry } from "../content/markdown.js";
import type { CommandPage } from "../content/loader.js";
import type { ExamplesFile } from "../content/schema.js";

/** Section headings and the `##` headings in `index.md` land in the same document, so they are
 *  slugged by the same algorithm: `github-slugger`, which is what `rehype-slug` uses for the
 *  prose side. A hand-rolled `[^a-z0-9]+` version disagreed with it on any title that wasn't
 *  plain ASCII, and reduced a title with no ASCII at all to the empty string — an `id=""` that
 *  the collision check below could not see, because it only fires on the second one. */
function slugify(title: string): string {
  return new GithubSlugger().slug(title);
}

/** Collapsed by default: useful when an output can't be interpreted without seeing its
 * input, but noise for a reader who already knows the data or is skimming for a flag. */
async function fixturesHtml(examplesFile: ExamplesFile): Promise<string> {
  const fixtures = examplesFile.fixtures ?? [];
  if (fixtures.length === 0) return "";

  const blocks = await Promise.all(
    fixtures.map(async (fixture) => {
      const body = await highlightCode(fixture.content, "plaintext");
      const note = fixture.note ? await renderInline(fixture.note, `fixture "${fixture.name}" note`) : "";
      return html`<div class="fixture">
<p class="fixture-name"><code>${fixture.name}</code>${note ? raw(html` <span class="fixture-note">${raw(note)}</span>`) : ""}</p>
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

export async function commandPage(page: CommandPage, cssHref: string): Promise<string> {
  const dateStr = isoDay(page.updated);
  const examplesFile = page.examples;

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
      const intro = section.intro
        ? await renderInline(section.intro, `section "${section.title}" intro`)
        : "";
      return html`<section class="example-section">
<h2 id="${sectionSlug}">${section.title}</h2>
${intro ? raw(html`<p class="section-intro">${raw(intro)}</p>`) : ""}
${cards.map((c) => raw(c))}
</section>`;
    }),
  );

  // Rendered only when there is something to expand. A page whose examples all document their
  // output has 79 collapsed blocks (awk) and a page with none has zero, and a button that does
  // nothing is worse than no button. Hidden without JS by styles/site.css, like every other
  // control whose behaviour is scripted.
  const collapsedOutputs = examplesFile.sections
    .flatMap((s) => s.examples)
    .filter((example) => example.output !== undefined).length;
  const outputToggle =
    collapsedOutputs === 0
      ? ""
      : html`<div class="examples-toolbar" data-pagefind-ignore>
<button class="toggle-outputs" type="button" data-toggle-outputs aria-pressed="false">Expand all output</button>
<span class="examples-toolbar-note">${collapsedOutputs} outputs, collapsed by default</span>
</div>`;

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
${raw(outputToggle)}
${sectionsHtml.map((s) => raw(s))}
${raw(related(page.relatedLinks))}
${raw(sourceLinks(page.slug, page.sources))}
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
    ogType: "article",
    modified: dateStr,
    jsonLd: techArticleJsonLd(page),
  });
}
