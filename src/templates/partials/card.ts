import { html } from "../../html.js";
import type { Page } from "../../content/loader.js";

export function pageCard(p: Page): string {
  return html`<article class="card"><a href="${p.url}">
<h3>${p.title}</h3>
<p>${p.description}</p>
</a></article>`;
}
