import type { Page } from "../content/loader.js";

/** A date as `YYYY-MM-DD`. Used for the visible "Updated" line, for `dateModified` in the
 *  structured data and for the sitemap, which all have to agree. */
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
