import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { copyPublic, writeHashedCss } from "./assets.js";
import { CATEGORY_META, NAV_ORDER, STANDALONE_PAGES } from "./config.js";
import { CONTENT_DIR, DIST_DIR, FIXTURE_DIR, OUTPUT_INDEX } from "./paths.js";
import { loadContent } from "./content/loader.js";
import { renderMarkdown } from "./content/markdown.js";
import { fillStats, verificationStats } from "./content/stats.js";
import { resetShikiStyles, shikiStyleCss } from "./content/shikiStyles.js";
import matter from "gray-matter";
import { type Listing, feedXml, sitemapXml } from "./feeds.js";
import { articlePage } from "./templates/article.js";
import { commandPage } from "./templates/command.js";
import { homePage } from "./templates/home.js";
import { listingPage } from "./templates/listing.js";
import { PAGE_SIZE, paginate } from "./templates/partials/pager.js";
import { notFoundPage } from "./templates/notFound.js";
import { standalonePage } from "./templates/standalone.js";
import { tagPage, tagsIndexPage } from "./templates/tags.js";

/** Stands in for the stylesheet's href while pages are being rendered.
 *
 *  The stylesheet carries the syntax-highlighting classes, which are cut from the rendered pages
 *  — so its content, and therefore its content hash, is not known until every page has been
 *  rendered. Pages are rendered against this token and it is substituted as they are written. */
const CSS_HREF_TOKEN = "\u0000css-href\u0000";

function writePage(distDir: string, urlPath: string, htmlContent: string, cssHref: string): void {
  const dir = urlPath === "/" ? distDir : join(distDir, urlPath.replace(/^\//, "").replace(/\/$/, ""));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, OUTPUT_INDEX), htmlContent.replaceAll(CSS_HREF_TOKEN, cssHref), "utf-8");
}

export interface BuildResult {
  pageCount: number;
  tagCount: number;
}

/** The build's first act is to delete its output directory, so it refuses to do that anywhere
 *  it did not put the output itself. `dist/` is the real target and a temporary directory is
 *  what the tests build into; anything else is a caller that has passed the wrong argument, and
 *  the damage would already be done by the time it noticed. */
function assertDisposable(distDir: string): void {
  const resolved = resolve(distDir);
  const allowed = resolved === DIST_DIR || resolved.startsWith(resolve(tmpdir()) + sep);
  if (!allowed) {
    throw new Error(
      `build: refusing to erase ${resolved} — the output directory must be ${DIST_DIR} or inside ${tmpdir()}`,
    );
  }
}

export async function build(
  contentDir: string = CONTENT_DIR,
  distDir: string = DIST_DIR,
  fixtureDir: string = FIXTURE_DIR,
): Promise<BuildResult> {
  assertDisposable(distDir);
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  copyPublic(distDir);

  // A long-lived process (the dev server) builds many times; the registry of highlighting
  // classes is per-build, so a colour no content uses any more does not linger in the stylesheet.
  resetShikiStyles();
  const cssHref = CSS_HREF_TOKEN;

  const { pages, tags } = await loadContent(contentDir, fixtureDir);

  // Rendered first, written second: nothing can be written until the stylesheet's hash is known,
  // and that is not known until the last page has been rendered.
  const rendered: { path: string; html: string }[] = [];
  const emit = (urlPath: string, htmlContent: string): void => {
    rendered.push({ path: urlPath, html: htmlContent });
  };

  emit("/", homePage(pages, cssHref));

  // Every listing page emitted, in the order emitted, so the sitemap can name them without
  // working out for itself which ones exist.
  const listings: Listing[] = [];

  for (const category of NAV_ORDER) {
    const categoryPages = pages.filter((p) => p.category === category);
    // `/commands/` is deliberately one page however long it gets: its topic grouping is its
    // navigation, and splitting it makes a command harder to find. See partials/pager.ts.
    const perPage = category === "commands" ? Infinity : PAGE_SIZE;
    for (const slice of paginate(categoryPages, CATEGORY_META[category].path, perPage)) {
      emit(slice.path, listingPage(category, slice, cssHref));
      listings.push({ path: slice.path, pages: slice.items });
    }
  }

  for (const page of pages) {
    emit(
      page.url,
      page.category === "commands" ? await commandPage(page, cssHref) : articlePage(page, cssHref),
    );
  }

  // A registered tag with no pages would otherwise render an empty card grid and be
  // listed as "(0)" on the index — build only the tag pages that have content.
  const populatedTags = tags
    .map((tag) => ({ tag, taggedPages: pages.filter((p) => p.tags.includes(tag.name)) }))
    .filter(({ taggedPages }) => taggedPages.length > 0);

  emit(
    "/tags/",
    tagsIndexPage(
      populatedTags.map(({ tag }) => tag),
      pages,
      cssHref,
    ),
  );
  listings.push({ path: "/tags/", pages });
  for (const { tag, taggedPages } of populatedTags) {
    for (const slice of paginate(taggedPages, `/tags/${tag.name}/`)) {
      emit(slice.path, tagPage(tag, slice, cssHref));
      listings.push({ path: slice.path, pages: slice.items });
    }
  }

  // A standalone page belongs to no category, so it is built here rather than through the
  // loader. Its figures are `{{token}}` placeholders in the Markdown, filled from a count of
  // the content: a page about verification is the last place a hand-typed number should live.
  const stats = verificationStats(pages, contentDir, fixtureDir);
  for (const standalone of STANDALONE_PAGES) {
    const parsed = matter(readFileSync(join(contentDir, standalone.source), "utf-8"));
    const rendered = await renderMarkdown(fillStats(parsed.content, stats));
    emit(
      standalone.path,
      standalonePage(
        {
          title: String(parsed.data.title),
          description: String(parsed.data.description),
          path: standalone.path,
          html: rendered.html,
          toc: rendered.toc,
        },
        cssHref,
      ),
    );
  }

  // Every page is rendered by now, so the highlighting classes are complete and the stylesheet
  // can be written and hashed. Only then can a page be written with a link to it.
  const finalCssHref = writeHashedCss(distDir, shikiStyleCss());
  for (const page of rendered) writePage(distDir, page.path, page.html, finalCssHref);

  writeFileSync(
    join(distDir, "404.html"),
    notFoundPage(cssHref).replaceAll(CSS_HREF_TOKEN, finalCssHref),
    "utf-8",
  );
  writeFileSync(join(distDir, "sitemap.xml"), sitemapXml(pages, listings), "utf-8");
  writeFileSync(join(distDir, "feed.xml"), feedXml(pages), "utf-8");

  return { pageCount: pages.length, tagCount: populatedTags.length };
}

async function main(): Promise<void> {
  const result = await build();
  console.log(`Built ${result.pageCount} page(s) to dist/`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
