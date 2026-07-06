import { CATEGORY_META, NAV_ORDER, SITE } from "./config.js";
import type { Page } from "./content/loader.js";

const XML_ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ESC[c]!);
}

export function sitemapXml(pages: Page[]): string {
  const categoryPaths = NAV_ORDER.map((c) => CATEGORY_META[c].path);
  const urls = ["/", ...categoryPaths, "/tags/", ...pages.map((p) => p.url)];
  const entries = urls.map((u) => `<url><loc>${SITE.url}${u}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>\n`;
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
