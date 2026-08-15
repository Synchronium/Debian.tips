import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyPublic, writeHashedCss } from "./assets.js";
import { CATEGORY_META, NAV_ORDER } from "./config.js";
import { loadContent, type Page } from "./content/loader.js";
import { feedXml, sitemapXml } from "./feeds.js";
import { articlePage } from "./templates/article.js";
import { commandPage } from "./templates/command.js";
import { homePage } from "./templates/home.js";
import { listingPage } from "./templates/listing.js";
import { notFoundPage } from "./templates/notFound.js";
import { tagPage, tagsIndexPage } from "./templates/tags.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function defaultContentDir(): string {
  return join(ROOT, "content");
}

function defaultDistDir(): string {
  return join(ROOT, "dist");
}

function writePage(distDir: string, urlPath: string, htmlContent: string): void {
  const dir = urlPath === "/" ? distDir : join(distDir, urlPath.replace(/^\//, "").replace(/\/$/, ""));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), htmlContent, "utf-8");
}

export interface BuildResult {
  pageCount: number;
  tagCount: number;
}

export async function build(
  contentDir: string = defaultContentDir(),
  distDir: string = defaultDistDir(),
): Promise<BuildResult> {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  copyPublic(distDir);
  const cssHref = writeHashedCss(distDir);

  const { pages, tags } = await loadContent(contentDir);

  writePage(distDir, "/", homePage(pages, cssHref));

  for (const category of NAV_ORDER) {
    const categoryPages = pages.filter((p) => p.category === category);
    writePage(distDir, CATEGORY_META[category].path, listingPage(category, categoryPages, cssHref));
  }

  for (const page of pages) {
    const rendered: string =
      page.category === "commands" ? await commandPage(page, cssHref) : articlePage(page, cssHref);
    writePage(distDir, page.url, rendered);
  }

  // A registered tag with no pages would otherwise render an empty card grid and be
  // listed as "(0)" on the index — build only the tag pages that have content.
  const populatedTags = tags
    .map((tag) => ({ tag, taggedPages: pages.filter((p) => p.tags.includes(tag.name)) }))
    .filter(({ taggedPages }) => taggedPages.length > 0);

  writePage(distDir, "/tags/", tagsIndexPage(populatedTags.map(({ tag }) => tag), pages, cssHref));
  for (const { tag, taggedPages } of populatedTags) {
    writePage(distDir, `/tags/${tag.name}/`, tagPage(tag, taggedPages, cssHref));
  }

  writeFileSync(join(distDir, "404.html"), notFoundPage(cssHref), "utf-8");
  writeFileSync(
    join(distDir, "sitemap.xml"),
    sitemapXml(pages, populatedTags.map(({ tag }) => tag)),
    "utf-8",
  );
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
