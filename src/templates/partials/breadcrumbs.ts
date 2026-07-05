import { html, raw } from "../../html.js";
import { CATEGORY_META } from "../../config.js";
import type { Category } from "../../content/schema.js";

export function breadcrumbs(category: Category, pageTitle: string): string {
  return html`<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>
<li><a href="/">Home</a></li>
<li><a href="${CATEGORY_META[category].path}">${CATEGORY_META[category].label}</a></li>
<li aria-current="page">${pageTitle}</li>
</ol></nav>`;
}
