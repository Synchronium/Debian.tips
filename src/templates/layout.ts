import { html, raw, type Raw } from "../html.js";
import { CATEGORY_META, NAV_ORDER, SITE } from "../config.js";
import type { Category } from "../content/schema.js";

export interface LayoutOptions {
  title: string;
  description: string;
  path: string;
  activeCategory?: Category;
  bodyHtml: Raw;
  jsonLd?: Record<string, unknown>;
  cssHref: string;
}

const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}" +
  "document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.add('js');}catch(e){}})();";

const INTERACTION_SCRIPT =
  "(function(){" +
  "function setTheme(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('theme',t);}catch(e){}}" +
  "document.addEventListener('click',function(ev){" +
  "var toggle=ev.target.closest('[data-theme-toggle]');" +
  "if(toggle){var cur=document.documentElement.getAttribute('data-theme');setTheme(cur==='dark'?'light':'dark');return;}" +
  "var copy=ev.target.closest('[data-copy]');" +
  "if(copy){navigator.clipboard.writeText(copy.getAttribute('data-copy'));" +
  "var original=copy.textContent;copy.textContent='Copied';" +
  "setTimeout(function(){copy.textContent=original;},1500);}" +
  "});" +
  "})();";

function headerHtml(activeCategory: Category | undefined): string {
  const navItems = NAV_ORDER.map((cat) => {
    const current = activeCategory === cat ? ' aria-current="page"' : "";
    return raw(html`<li><a href="${CATEGORY_META[cat].path}"${raw(current)}>${CATEGORY_META[cat].label}</a></li>`);
  });
  return html`<header class="site-header">
<a class="skip-link" href="#main">Skip to content</a>
<div class="header-inner">
<a class="logo" href="/"><span class="logo-glyph" aria-hidden="true">&gt;_</span>debian<span class="accent">.tips</span></a>
<details class="nav-disclosure">
<summary>Menu</summary>
<nav aria-label="Primary"><ul>${navItems}</ul></nav>
</details>
<button type="button" data-theme-toggle aria-label="Toggle color theme">Theme</button>
</div>
</header>`;
}

function footerHtml(): string {
  const exploreItems = NAV_ORDER.map((cat) =>
    raw(html`<li><a href="${CATEGORY_META[cat].path}">${CATEGORY_META[cat].label}</a></li>`),
  );
  return html`<footer class="site-footer">
<div class="footer-inner">
<nav aria-label="Explore"><h2>Explore</h2><ul>${exploreItems}</ul></nav>
<nav aria-label="Meta"><h2>Meta</h2><ul>
<li><a href="/feed.xml">RSS</a></li>
<li><a href="https://github.com/Synchronium/Debian.tips">GitHub</a></li>
</ul></nav>
<p class="footer-tagline">Made for the terminal-curious. Tested on Debian stable.</p>
</div>
<p class="footer-copyright">debian.tips is an independent site, not affiliated with the Debian Project.</p>
</footer>`;
}

export function layout(opts: LayoutOptions): string {
  const canonical = `${SITE.url}${opts.path}`;
  const pageTitle = opts.path === "/" ? `${SITE.title} — ${SITE.tagline}` : `${opts.title} — ${SITE.title}`;

  return html`<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${pageTitle}</title>
<meta name="description" content="${opts.description}" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" type="application/rss+xml" title="${SITE.title}" href="/feed.xml" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE.title}" />
<meta property="og:title" content="${opts.title}" />
<meta property="og:description" content="${opts.description}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${SITE.url}/og-default.png" />
<meta name="twitter:card" content="summary_large_image" />
<script>${raw(THEME_SCRIPT)}</script>
<link rel="stylesheet" href="${opts.cssHref}" />
${opts.jsonLd ? raw(html`<script type="application/ld+json">${raw(JSON.stringify(opts.jsonLd))}</script>`) : ""}
</head>
<body>
${raw(headerHtml(opts.activeCategory))}
<main id="main" data-pagefind-body>
${opts.bodyHtml}
</main>
${raw(footerHtml())}
<div aria-live="polite" class="visually-hidden" id="live-region"></div>
<script>${raw(INTERACTION_SCRIPT)}</script>
</body>
</html>
`;
}
