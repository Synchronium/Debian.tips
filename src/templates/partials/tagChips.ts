import { html, raw } from "../../html.js";

export function tagChips(tags: string[]): string {
  if (tags.length === 0) return "";
  return html`<ul class="tags">
${tags.map((t) => raw(html`<li><a href="/tags/${t}/">${t}</a></li>`))}
</ul>`;
}
