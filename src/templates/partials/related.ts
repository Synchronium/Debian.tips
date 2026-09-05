import { EMPTY_HTML, html, type Raw } from "../../html.js";
import type { PageLink } from "../../content/loader.js";

/** The "Related" block that closes a content page. Identical on command pages and articles. */
export function related(links: PageLink[]): Raw {
  if (links.length === 0) return EMPTY_HTML;
  return html`<nav class="related" aria-label="Related pages"><h2>Related</h2><ul>
${links.map((link) => html`<li><a href="${link.url}">${link.title}</a></li>`)}
</ul></nav>`;
}
