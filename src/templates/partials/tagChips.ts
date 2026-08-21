import { html, raw } from "../../html.js";
import { tagPath } from "../../config.js";

export function tagChips(tags: string[]): string {
  if (tags.length === 0) return "";
  return html`<ul class="tags">
${tags.map((t) => raw(html`<li><a href="${tagPath(t)}">${t}</a></li>`))}
</ul>`;
}
