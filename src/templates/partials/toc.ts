import { html, raw } from "../../html.js";
import type { TocEntry } from "../../content/markdown.js";

export function toc(entries: TocEntry[]): string {
  if (entries.length === 0) return "";
  return html`<nav class="toc" aria-label="On this page">
<p class="toc-title">On this page</p>
<ul>
${entries.map((e) => raw(html`<li class="toc-level-${e.level}"><a href="#${e.id}">${e.text}</a></li>`))}
</ul>
</nav>`;
}
