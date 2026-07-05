import { html, raw } from "../../html.js";
import type { PageLink } from "../../content/loader.js";

export function prevNext(prev: PageLink | undefined, next: PageLink | undefined): string {
  if (!prev && !next) return "";
  return html`<nav class="pager" aria-label="Series">
${prev ? raw(html`<a class="pager-prev" href="${prev.url}">&larr; ${prev.title}</a>`) : raw("<span></span>")}
${next ? raw(html`<a class="pager-next" href="${next.url}">${next.title} &rarr;</a>`) : ""}
</nav>`;
}
