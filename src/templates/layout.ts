import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { join } from "node:path";
import { html, raw, type Raw } from "../html.js";
import { CATEGORY_META, NAV_ORDER, SITE, STANDALONE_PAGES } from "../config.js";
import { CLIENT_DIR } from "../paths.js";
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
  /** `article` for a content page, `website` for the chrome around it (home, listings, tags).
   *  Social cards and structured-data consumers treat the two differently. */
  ogType?: "website" | "article";
  /** ISO date for `article:modified_time`, on the pages that are articles. */
  modified?: string;
  /** `rel="prev"`/`rel="next"` for a paginated listing, so a crawler reads the pages as one
   *  sequence rather than as near-duplicates of each other. */
  prevPath?: string;
  nextPath?: string;
  /** Only command/article pages set this — Pagefind indexes solely inside elements
   * carrying this attribute once it's present anywhere on the site, so leaving it
   * off listing/tag/home/404 pages keeps search results to actual content pages. */
  indexable?: boolean;
}

/** Only fires in production builds so local dev doesn't pollute analytics. */
function analyticsHtml(): string {
  if (process.env["NODE_ENV"] !== "production") return "";
  const id = SITE.gaMeasurementId;
  return html`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>${raw(`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`)}</script>`;
}

/** Compiled and minified once per build, then inlined into every page.
 *
 *  These run before and during first paint, so they are inlined rather than fetched — a request
 *  per page for this much would cost more than it saves, and the theme script has to run before
 *  the page renders or it renders in the wrong theme first.
 *
 *  Compiling means the source can be ordinary TypeScript — checked by `tsconfig.client.json`,
 *  formatted by Prettier, readable — while what ships is small. Before this it was hand-written
 *  ES5 inlined verbatim, which is what happens when there is nowhere to compile.
 *
 *  Cached because the layout runs for every page and neither file changes between them. The
 *  `</script` check runs on the *output*: minification can move a string, and a page that stops
 *  parsing halfway is a bad way to find that out. */
const scriptCache = new Map<string, string>();
function clientScript(filename: string): string {
  const cached = scriptCache.get(filename);
  if (cached !== undefined) return cached;

  const source = readFileSync(join(CLIENT_DIR, filename), "utf-8");
  // es2020: optional chaining and nullish coalescing survive as-is, and everything this site
  // supports has had them for years. Not `esnext`, which would pass through syntax newer than
  // the browsers these pages are read in.
  // Wrapped before compiling rather than with esbuild's `format: "iife"`. Both stop every
  // top-level name — `setTheme`, `copy`, `COPIED_MS` — becoming a global on every page, which is
  // what the hand-written ES5 version used its own IIFE for. But `format: "iife"` also decides
  // the dynamic `import()` needs CommonJS interop and emits ~300 bytes of __toESM helpers to
  // support it. Wrapping the source keeps those out, and esbuild can still shorten the names
  // because it can see nothing outside the function reaches them.
  const { code } = transformSync(`(() => {\n${source}\n})();`, {
    loader: "ts",
    minify: true,
    target: "es2020",
  });

  if (/<\/script/i.test(code)) {
    throw new Error(
      `${filename}: compiles to code containing "</script", which would end the inline script early`,
    );
  }
  scriptCache.set(filename, code);
  return code;
}

function headerHtml(activeCategory: Category | undefined): string {
  const navItems = NAV_ORDER.map((cat) => {
    const current = activeCategory === cat ? ' aria-current="page"' : "";
    return raw(
      html`<li><a href="${CATEGORY_META[cat].path}"${raw(current)}>${CATEGORY_META[cat].label}</a></li>`,
    );
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
${STANDALONE_PAGES.map((s) => raw(html`<li><a href="${s.path}">${s.navLabel}</a></li>`))}
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
 * assets/search.js on first open.
 *
 * The result list itself is not a live region: replacing its contents on every keystroke made a
 * screen reader announce every result again, mid-typing. The status line beside it says how many
 * there are, which is the part worth hearing. */
function searchDialogHtml(): string {
  return html`<dialog id="search-dialog" aria-label="Search debian.tips">
<div class="search-dialog-inner">
<div class="search-input-row">
<span aria-hidden="true" class="search-trigger-icon">⌕</span>
<input type="search" id="search-input" placeholder="Search commands, concepts, recipes…" aria-label="Search debian.tips" autocomplete="off" spellcheck="false" />
<button type="button" data-search-close aria-label="Close search">Close</button>
</div>
<ul id="search-results"></ul>
<p class="visually-hidden" role="status" id="search-status"></p>
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

  // No data-theme attribute: styles/site.css defaults to dark and honours
  // prefers-color-scheme, so visitors without JS get their OS preference instead of
  // being pinned to dark. src/client/theme-init.js sets an explicit attribute before paint for
  // everyone else, which then wins over the media query in both directions.
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${raw(analyticsHtml())}
<title>${pageTitle}</title>
<meta name="description" content="${opts.description}" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" type="application/rss+xml" title="${SITE.title}" href="/feed.xml" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<meta property="og:type" content="${opts.ogType ?? "website"}" />
<meta property="og:site_name" content="${SITE.title}" />
<meta property="og:title" content="${opts.title}" />
<meta property="og:description" content="${opts.description}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${SITE.url}/og-default.png" />
<meta name="twitter:card" content="summary_large_image" />
${opts.modified ? raw(html`<meta property="article:modified_time" content="${opts.modified}" />`) : ""}
${opts.prevPath ? raw(html`<link rel="prev" href="${SITE.url}${opts.prevPath}" />`) : ""}
${opts.nextPath ? raw(html`<link rel="next" href="${SITE.url}${opts.nextPath}" />`) : ""}
<script>${raw(clientScript("theme-init.ts"))}</script>
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
<script>${raw(clientScript("interaction.ts"))}</script>
</body>
</html>
`;
}
