import { html, raw } from "../../html.js";
import type { Page } from "../../content/loader.js";

/** `level` must match whatever actually precedes the card grid in a given
 * template: h3 when cards sit under a real h2 section heading (home
 * category sections, grouped command listings), h2 when cards sit directly
 * under the page's own h1 (tag pages, non-grouped category listings) — see
 * PLAN-BUILD.md §8.1, "heading levels never skip." */
export function pageCard(p: Page, level: "h2" | "h3" = "h3"): string {
  return html`<article class="card"><a href="${p.url}">
${raw(`<${level}>`)}${p.title}${raw(`</${level}>`)}
<p>${p.description}</p>
</a></article>`;
}
