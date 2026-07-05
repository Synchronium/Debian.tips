import { html, raw } from "../html.js";
import { layout } from "./layout.js";

export function notFoundPage(cssHref: string): string {
  const body = html`
<h1>Page not found</h1>
<p>The page you're looking for doesn't exist or has moved.</p>
<p><a href="/commands/">Browse commands</a> &middot; <a href="/concepts/">Browse concepts</a></p>`;

  return layout({
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has moved.",
    path: "/404.html",
    bodyHtml: raw(body),
    cssHref,
  });
}
