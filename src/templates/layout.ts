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
  draft?: boolean;
  /** Only command/article pages set this — Pagefind indexes solely inside elements
   * carrying this attribute once it's present anywhere on the site, so leaving it
   * off listing/tag/home/404 pages keeps search results to actual content pages. */
  indexable?: boolean;
}

const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}" +
  "document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.add('js');}catch(e){}})();";

/** Always-loaded glue: theme toggle, copy buttons, and the search trigger. The
 * search dialog's own wiring (and Pagefind itself) live in /assets/search.js,
 * fetched via dynamic import() only when the dialog is first opened — see
 * PLAN-BUILD.md §6, "Pagefind assets load only when the user opens search." */
const INTERACTION_SCRIPT =
  "(function(){" +
  "function setTheme(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('theme',t);}catch(e){}}" +
  "function openSearch(){import('/assets/search.js').then(function(m){m.openSearch();});}" +
  "document.addEventListener('click',function(ev){" +
  "if(ev.target.closest('[data-theme-toggle]')){var cur=document.documentElement.getAttribute('data-theme');setTheme(cur==='dark'?'light':'dark');return;}" +
  "if(ev.target.closest('[data-search-open]')){ev.preventDefault();openSearch();return;}" +
  "var copy=ev.target.closest('[data-copy]');" +
  "if(copy){" +
  "var original=copy.dataset.label||(copy.dataset.label=copy.textContent);" +
  "navigator.clipboard.writeText(copy.getAttribute('data-copy')).then(function(){" +
  "copy.textContent='Copied';" +
  "var live=document.getElementById('live-region');if(live)live.textContent='Copied to clipboard';" +
  "clearTimeout(copy._copyTimeout);" +
  "copy._copyTimeout=setTimeout(function(){copy.textContent=original;delete copy.dataset.label;},1500);" +
  "});}" +
  "});" +
  "document.addEventListener('keydown',function(ev){" +
  "if((ev.metaKey||ev.ctrlKey)&&ev.key==='k'){ev.preventDefault();openSearch();}" +
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
<div class="header-actions">
<button type="button" class="search-trigger" data-search-open aria-haspopup="dialog" aria-controls="search-dialog" aria-label="Search">
<span aria-hidden="true" class="search-trigger-icon">⌕</span>
<span class="search-trigger-label">Search</span>
<kbd class="search-trigger-kbd" aria-hidden="true">⌘K</kbd>
</button>
<button type="button" data-theme-toggle aria-label="Toggle color theme"><span aria-hidden="true" class="theme-toggle-icon">&#9680;</span><span class="theme-toggle-label">Theme</span></button>
</div>
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

/** Static markup only — no results are pre-rendered, so this ships fine to every
 * page without needing Pagefind at build time. All behaviour is wired by
 * assets/search.js on first open. */
function searchDialogHtml(): string {
  return html`<dialog id="search-dialog" aria-label="Search debian.tips">
<div class="search-dialog-inner">
<div class="search-input-row">
<span aria-hidden="true" class="search-trigger-icon">⌕</span>
<input type="search" id="search-input" placeholder="Search commands, concepts, recipes…" aria-label="Search debian.tips" autocomplete="off" spellcheck="false" />
<button type="button" data-search-close aria-label="Close search">Close</button>
</div>
<ul id="search-results" aria-live="polite"></ul>
</div>
</dialog>`;
}

/** JSON.stringify never escapes "<", so a title/description containing "</script>"
 * would otherwise break out of the element. Escaping is invisible to JSON parsers. */
function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function layout(opts: LayoutOptions): string {
  const canonical = `${SITE.url}${opts.path}`;
  const pageTitle = opts.path === "/" ? `${SITE.title} — ${SITE.tagline}` : `${opts.title} — ${SITE.title}`;
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.title,
    url: SITE.url,
    description: SITE.description,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

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
<script type="application/ld+json">${raw(safeJsonLd(websiteJsonLd))}</script>
${opts.jsonLd ? raw(html`<script type="application/ld+json">${raw(safeJsonLd(opts.jsonLd))}</script>`) : ""}
</head>
<body>
${raw(headerHtml(opts.activeCategory))}
${opts.draft ? raw(html`<div class="draft-banner" role="note">Draft — excluded from production builds</div>`) : ""}
<main id="main"${opts.indexable ? raw(" data-pagefind-body") : ""}>
${opts.bodyHtml}
</main>
${raw(footerHtml())}
${raw(searchDialogHtml())}
<div aria-live="polite" class="visually-hidden" id="live-region"></div>
<script>${raw(INTERACTION_SCRIPT)}</script>
</body>
</html>
`;
}
