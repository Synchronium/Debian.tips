import type { Page } from "../content/loader.js";

/** A date as `YYYY-MM-DD`.
 *
 *  Four readers, which is why it is a function rather than an expression written at each: the
 *  visible "Updated" line, `dateModified` in a page's structured data, `article:modified_time` in
 *  its head, and `<lastmod>` in the sitemap. A crawler compares the last two against each other,
 *  so a second implementation that rounded differently would be a disagreement about one page
 *  rather than a difference of style. `src/feeds.ts` had one until it was pointed here. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Structured data for one content page. Command pages and articles publish the same shape, so
 *  they build it in the same place rather than each carrying a copy of the literal. */
export function techArticleJsonLd(page: Page): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.description,
    dateModified: isoDay(page.updated),
  };
}
