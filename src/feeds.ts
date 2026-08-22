import { FEED_PATH, SITE, STANDALONE_PAGES } from "./config.js";
import type { Page } from "./content/loader.js";

const XML_ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};
function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ESC[c]!);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Newest `updated` among the given pages, or undefined for an empty set. */
function newestUpdate(pages: Page[]): Date | undefined {
  return pages.reduce<Date | undefined>(
    (newest, p) => (newest === undefined || p.updated > newest ? p.updated : newest),
    undefined,
  );
}

/** One emitted listing page: a category index, a tag page, or a later page of either. */
export interface Listing {
  path: string;
  /** The pages it lists, which is what dates it. */
  pages: Page[];
}

/** `listings` is what the build actually emitted, passed in rather than re-derived here: a
 *  second opinion about which listings exist gets two things wrong, since a tag with no pages
 *  gets no page built and a listing long enough to paginate emits several paths rather than
 *  one. */
export function sitemapXml(pages: Page[], listings: Listing[]): string {
  const entries: { path: string; lastmod?: Date | undefined }[] = [
    { path: "/", lastmod: newestUpdate(pages) },
    ...listings.map((listing) => ({ path: listing.path, lastmod: newestUpdate(listing.pages) })),
    // Belong to no category and so aren't in `pages`, but they are real pages that should be
    // findable. Their content changes whenever any page does, since their figures are counted.
    ...STANDALONE_PAGES.map((s) => ({ path: s.path, lastmod: newestUpdate(pages) })),
    ...pages.map((p) => ({ path: p.url, lastmod: p.updated })),
  ];

  const xml = entries
    .map(({ path, lastmod }) => {
      const loc = `<loc>${escapeXml(`${SITE.url}${path}`)}</loc>`;
      return `<url>${loc}${lastmod ? `<lastmod>${isoDate(lastmod)}</lastmod>` : ""}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xml}</urlset>\n`;
}

export function feedXml(pages: Page[]): string {
  const latest = [...pages].sort((a, b) => b.updated.getTime() - a.updated.getTime()).slice(0, 20);
  const updated = latest[0]?.updated.toISOString() ?? new Date(0).toISOString();

  const entries = latest
    .map(
      (p) => `<entry>
<title>${escapeXml(p.title)}</title>
<link href="${SITE.url}${p.url}" />
<id>${SITE.url}${p.url}</id>
<updated>${p.updated.toISOString()}</updated>
<summary>${escapeXml(p.description)}</summary>
</entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>${escapeXml(SITE.title)}</title>
<link href="${SITE.url}${FEED_PATH}" rel="self" />
<link href="${SITE.url}/" />
<id>${SITE.url}/</id>
<updated>${updated}</updated>
<author><name>${escapeXml(SITE.title)}</name></author>
${entries}
</feed>
`;
}
