// Writes the URL list pa11y-ci checks, from the sitemap the build just produced.
//
//   npm run a11y                                  # generate the list, then check it
//   npx tsx scripts/gates/pa11y-urls.ts [origin]        # just this step; default is LOCAL_ORIGIN
//
// Generated rather than hand-written: a typed list silently stops covering the site as
// categories are added, and the symptom is a gate that passes because it is checking less.
//
// Not every page, which would be hundreds of headless-browser loads for near-identical markup.
// One page per *template*, plus every listing, which is where the markup actually varies:
// a second command page tells you nothing the first one didn't.
//
// Written to `.pa11yci.generated.json`, which is untracked, rather than back into `.pa11yci.json`.
// The two halves are different kinds of thing: the settings are hand-maintained and belong in git,
// while the URLs are output, and output committed beside its own generator goes stale in the
// repository and dirties the working tree of anyone who runs the gate. It had already drifted by
// one page when this was split.
//
// The list-building is exported as a function and the file handling is confined to `main`, the
// arrangement `scripts/replay/command-page.ts` uses, so `test/pa11yUrls.test.ts` can put a sitemap
// in and read a list out without a build, a subprocess or a temporary directory.
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CATEGORY_META, LOCAL_ORIGIN, NAV_ORDER, NOT_FOUND_PATH, TAGS_PATH } from "../../src/config.js";
import { DIST_DIR, PA11Y_CONFIG, PA11Y_GENERATED_CONFIG, ROOT, SITEMAP_FILE } from "../../src/paths.js";

/** The URL list came out short, so nothing is written. Its own class because the caller has to
 *  tell it from a missing sitemap or an unreadable settings file, which are different repairs. */
export class Pa11yUrlsError extends Error {}

/** The pages to check, from the XML of a built sitemap.
 *
 *  Throws rather than returning a short list, and that is the whole reason this check exists here:
 *  **pa11y-ci cannot fail on a list that is too short.** Given no URLs at all it prints "Running
 *  Pa11y on 0 URLs / 0/0 URLs passed" and exits 0, with or without a config file. So every way the
 *  list can come out short ends in a green tick over nothing, and nothing downstream will say so.
 *
 *  Completeness is asserted against the categories rather than a count, so the check describes
 *  what the list is for: one page per template, and a category listing is a template. A number
 *  here would need updating whenever a category was added, which is exactly when it would be
 *  wrong. */
export function pa11yUrls(sitemapXml: string, origin: string = LOCAL_ORIGIN): string[] {
  // Parsed as a URL rather than pattern-matched: the sitemap holds absolute locations, and taking
  // the path with a regex quietly produced `//debian.tips/commands/`, which is a path, resolves
  // against the origin, and 404s.
  const paths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => new URL(match[1] ?? "").pathname,
  );

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

  // Both halves of "one page per template" are asserted, because they fail apart. A listing goes
  // missing when the sitemap is short; a sample goes missing when `isContentPage` stops matching,
  // which a change to the route shape would do, and the listings would still all be there to make
  // the list look complete.
  const missing = NAV_ORDER.flatMap((category) => {
    const listing = CATEGORY_META[category].path;
    return [
      urls.includes(`${origin}${listing}`) ? [] : [`${listing} (the category listing)`],
      samples.has(category) ? [] : [`${listing} (a page from inside it)`],
    ].flat();
  });
  if (missing.length) {
    throw new Pa11yUrlsError(
      `${missing.length} page(s) missing from the URL list:\n` +
        missing.map((what) => `  ${what}`).join("\n") +
        `\n\nRead ${paths.length} location(s) from the sitemap. Either the build did not emit them ` +
        `or the parse is broken.\nNot writing a config: pa11y-ci passes an empty list, so a short ` +
        `one is worse than no run at all.`,
    );
  }
  return urls;
}

function main(): void {
  const origin = process.argv[2] ?? LOCAL_ORIGIN;
  const sitemap = join(DIST_DIR, SITEMAP_FILE);

  let urls: string[];
  try {
    urls = pa11yUrls(readFileSync(sitemap, "utf-8"), origin);
  } catch (error) {
    if (!(error instanceof Pa11yUrlsError)) throw error;
    console.error(`pa11y-urls: ${error.message}`);
    process.exit(1);
  }

  // The hand-maintained settings (the WCAG standard, the timeout, Chrome's flags) are read from
  // the tracked file and passed through, so there is one place to change them and this only ever
  // adds the part it computes.
  const settings = JSON.parse(readFileSync(PA11Y_CONFIG, "utf-8")) as Record<string, unknown>;
  writeFileSync(PA11Y_GENERATED_CONFIG, `${JSON.stringify({ ...settings, urls }, null, 2)}\n`, "utf-8");
  console.log(`${relative(ROOT, PA11Y_GENERATED_CONFIG)}: ${urls.length} URL(s) to check`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
