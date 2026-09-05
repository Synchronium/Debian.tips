import { EMPTY_HTML, html, type Raw } from "../../html.js";
import { tagPath } from "../../config.js";

export function tagChips(tags: string[]): Raw {
  if (tags.length === 0) return EMPTY_HTML;
  return html`<ul class="tags">
${tags.map((t) => html`<li><a href="${tagPath(t)}">${t}</a></li>`)}
</ul>`;
}
