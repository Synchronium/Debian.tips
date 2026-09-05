import { EMPTY_HTML, html, raw, type Raw } from "../../html.js";
import type { PageLink } from "../../content/loader.js";

export function prevNext(prev: PageLink | undefined, next: PageLink | undefined): Raw {
  if (!prev && !next) return EMPTY_HTML;
  return html`<nav class="pager" aria-label="Series">
${prev ? html`<a class="pager-prev" href="${prev.url}">&larr; ${prev.title}</a>` : raw("<span></span>")}
${next ? html`<a class="pager-next" href="${next.url}">${next.title} &rarr;</a>` : ""}
</nav>`;
}
