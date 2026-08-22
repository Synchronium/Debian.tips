// Writes the URL list pa11y-ci checks, from the sitemap the build just produced.
//
//   npx tsx scripts/pa11y-urls.ts [origin]        # default http://localhost:4321
//
// Generated rather than hand-written: a typed list silently stops covering the site as
// categories are added, and the symptom is a gate that passes because it is checking less.
//
// Not every page, which would be hundreds of headless-browser loads for near-identical markup.
// One page per *template*, plus every listing, which is where the markup actually varies:
// a second command page tells you nothing the first one didn't.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NOT_FOUND_PATH, TAGS_PATH } from "../src/config.js";
import { DIST_DIR, ROOT, SITEMAP_FILE } from "../src/paths.js";

const origin = process.argv[2] ?? "http://localhost:4321";
const config = join(ROOT, ".pa11yci.json");

const sitemap = readFileSync(join(DIST_DIR, SITEMAP_FILE), "utf-8");
// Parsed as a URL rather than pattern-matched: the sitemap holds absolute locations, and taking
// the path with a regex quietly produced `//debian.tips/commands/`, which is a path, resolves
// against the origin, and 404s.
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? "").pathname);

/** A content page's path is `/category/slug/`; a listing's is `/category/`. */
const isContentPage = (path: string): boolean =>
  /^\/[^/]+\/[^/]+\/$/.test(path) && !path.startsWith(TAGS_PATH);
const categoryOf = (path: string): string => path.split("/")[1] ?? "";

const listings = paths.filter((path) => !isContentPage(path));
// One content page per category, chosen as the first in sitemap order so the list is stable
// between runs rather than depending on what happens to have been edited.
const samples = new Map<string, string>();
for (const path of paths.filter(isContentPage)) {
  const category = categoryOf(path);
  if (!samples.has(category)) samples.set(category, path);
}

// Tag pages are listings and there are dozens of them; they are all the same template, so one
// is enough. The tags index itself is a different template and stays.
const tagPages = listings.filter((path) => path.startsWith(TAGS_PATH) && path !== TAGS_PATH);
const otherListings = listings.filter((path) => !path.startsWith(TAGS_PATH) || path === TAGS_PATH);

const urls = [...otherListings, ...(tagPages[0] ? [tagPages[0]] : []), ...samples.values()]
  .map((path) => `${origin}${path}`)
  // The 404 page is deliberately not in the sitemap, since nothing should crawl to it, but it is
  // a template with its own markup, and one nobody looks at until it is already being seen.
  .concat(`${origin}${NOT_FOUND_PATH}`);

const existing = JSON.parse(readFileSync(config, "utf-8")) as Record<string, unknown>;
writeFileSync(config, `${JSON.stringify({ ...existing, urls }, null, 2)}\n`, "utf-8");
console.log(`.pa11yci.json: ${urls.length} URL(s) to check`);
