import { EMPTY_HTML, html, type Raw } from "../../html.js";
import type { TocEntry } from "../../content/markdown.js";

export function toc(entries: TocEntry[]): Raw {
  if (entries.length === 0) return EMPTY_HTML;
  return html`<nav class="toc" aria-label="On this page">
<p class="toc-title">On this page</p>
<ul>
${entries.map((e) => html`<li class="toc-level-${e.level}"><a href="#${e.id}">${e.text}</a></li>`)}
</ul>
</nav>`;
}
