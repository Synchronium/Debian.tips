import { html, raw } from "../../html.js";
import type { PageLink } from "../../content/loader.js";

/** The "Related" block that closes a content page. Identical on command pages and articles,
 *  and duplicated between the two templates until it moved here. */
export function related(links: PageLink[]): string {
  if (links.length === 0) return "";
  return html`<nav class="related" aria-label="Related pages"><h2>Related</h2><ul>
${links.map((link) => raw(html`<li><a href="${link.url}">${link.title}</a></li>`))}
</ul></nav>`;
}
