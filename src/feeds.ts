import { CATEGORY_META, NAV_ORDER, SITE } from "./config.js";
import type { Page, TagInfo } from "./content/loader.js";

const XML_ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
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

/** `tags` is the set of tag pages actually emitted — tags with no pages don't get a
 * page built (see build.ts), so listing them here would advertise a 404. */
export function sitemapXml(pages: Page[], tags: TagInfo[]): string {
  const entries: { path: string; lastmod?: Date | undefined }[] = [
    { path: "/", lastmod: newestUpdate(pages) },
    ...NAV_ORDER.map((c) => ({
      path: CATEGORY_META[c].path,
      lastmod: newestUpdate(pages.filter((p) => p.category === c)),
    })),
    { path: "/tags/", lastmod: newestUpdate(pages) },
    // Belongs to no category and so isn't in `pages`, but it is a real page that should be
    // findable. Its content changes whenever any page does, since its figures are counted.
    { path: "/about/", lastmod: newestUpdate(pages) },
    ...tags.map((t) => ({
      path: `/tags/${t.name}/`,
      lastmod: newestUpdate(pages.filter((p) => p.tags.includes(t.name))),
    })),
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
<link href="${SITE.url}/feed.xml" rel="self" />
<link href="${SITE.url}/" />
<id>${SITE.url}/</id>
<updated>${updated}</updated>
<author><name>${escapeXml(SITE.title)}</name></author>
${entries}
</feed>
`;
}
