// The checks that need a real browser against a built site, run after `npx serve dist`.
//
//   npm run browser                              # both checks
//   npx tsx scripts/browser-check.ts [origin]    # default is LOCAL_ORIGIN
//
// Two things about this site cannot be established by building it. The first is search, which runs
// entirely in the browser against Pagefind's WASM bundle, so nothing in `npm run check` loads it
// and a broken search still builds, still passes every test, still passes the accessibility gate
// (which never opens the dialog) and still deploys. The second is narrow-screen layout, where a
// stylesheet change can make a page scroll sideways without altering a byte of markup.
//
// Both are asserted as properties rather than compared against stored output; ADR-0022 has why,
// and why there are no screenshots here.
//
// Separate from `npm run a11y` because pa11y-ci owns its own browser and its own config. They run
// as adjacent CI steps against the same served build.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { LOCAL_ORIGIN } from "../src/config.js";
import { DIST_DIR, SITEMAP_FILE } from "../src/paths.js";
import { pa11yUrls } from "./pa11y-urls.js";

/** The narrowest screen worth supporting. Below this, a phone's own browser starts scaling the
 *  viewport rather than laying out at the width it reports. */
const NARROW = { width: 320, height: 640 } as const;

/** Long enough for Pagefind to fetch and instantiate its WASM bundle on a cold cache, plus the
 *  debounce inside `debouncedSearch`. Past this the check reports rather than waits longer. */
const SEARCH_TIMEOUT_MS = 15_000;

/** How many overflowing elements to name. The point is to say where to look, not to list every
 *  descendant of one wide table. */
const CULPRITS_SHOWN = 3;

/** What the checks report. A `detail` is printed under the check that produced it, so it says
 *  which page and what was seen rather than only that something was wrong. */
interface Failure {
  check: string;
  detail: string;
}

/** A term certain to be in the index, taken from the site being checked rather than written down
 *  here: a command page's slug appears in its own title and throughout its body. Deriving it means
 *  the check cannot outlive the page it names, which a hardcoded query would do silently. */
function indexedTerm(sitemapXml: string): string {
  const slugs = [...sitemapXml.matchAll(/<loc>[^<]*\/commands\/([^/<]+)\/<\/loc>/g)].map(
    (match) => match[1] ?? "",
  );
  const term = slugs.sort()[0];
  if (!term) throw new Error("no command page in the sitemap to search for");
  return term;
}

/** Open the dialog, search for a term the site indexes, and read back what the reader would see.
 *
 *  One query, because the path it takes is the whole of what there is to check: the dialog opens,
 *  the bundle loaded and answered, a result rendered with a title, and its href goes somewhere.
 *  A second query walks the same path.
 *
 *  It has to be a real browser. A mocked Pagefind would be built from `src/client/ambient.d.ts`,
 *  which is a hand-written description of somebody else's API, so the test would assert that the
 *  code matches the assumption using the assumption, and would pass on the day the assumption went
 *  stale, which is a day any Pagefind bump can bring. */
async function checkSearch(page: Page, origin: string, term: string): Promise<Failure[]> {
  const failures: Failure[] = [];
  const fail = (detail: string): number => failures.push({ check: `search for "${term}"`, detail });

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(origin, { waitUntil: "load" });
  await page.click("[data-search-open]");

  try {
    await page.waitForSelector("#search-dialog[open]", { timeout: SEARCH_TIMEOUT_MS });
  } catch {
    fail("the dialog never opened; [data-search-open] is wired in src/client/interaction.ts");
    return failures;
  }

  await page.type("#search-input", term);

  // Settled means the search wrote something, either a status line or the message it shows when
  // there is nothing to show. Waiting on a result element instead would time out on a real
  // no-results answer and report it as a hang, which is a different repair.
  try {
    await page.waitForFunction(
      () =>
        (document.getElementById("search-status")?.textContent ?? "") !== "" ||
        document.querySelector("#search-results .search-empty") !== null,
      { timeout: SEARCH_TIMEOUT_MS },
    );
  } catch {
    fail("nothing was rendered before the timeout; Pagefind's bundle may not have loaded");
    return failures;
  }

  const seen = await page.evaluate(() => ({
    status: document.getElementById("search-status")?.textContent ?? "",
    empty: document.querySelector("#search-results .search-empty")?.textContent ?? "",
    results: [...document.querySelectorAll("#search-results li a")].map((link) => ({
      href: link.getAttribute("href") ?? "",
      title: link.querySelector(".search-result-title")?.textContent ?? "",
    })),
  }));

  const first = seen.results[0];
  if (!first) {
    // The two ways to get here are worth telling apart. "Search index unavailable" is the
    // fail-open path in runSearch, and means dist/pagefind/ was not built or not served; anything
    // else means Pagefind answered and had nothing.
    fail(seen.empty ? `no results: ${seen.empty}` : "no results and no message saying why");
    return failures;
  }

  if (!first.title.trim()) fail(`the first result renders an empty title for ${first.href}`);

  // Resolved rather than pattern-matched. The href is built in runSearch from what Pagefind
  // returns, and the failure worth catching is one that looks like a URL and goes nowhere.
  const target = new URL(first.href, origin);
  const response = await fetch(target);
  if (!response.ok) fail(`the first result links to ${target.pathname}, which answered ${response.status}`);

  // Reaching this line means runSearch ran to the end rather than returning early.
  if (!/^\d+ results?\.$/.test(seen.status)) {
    fail(`the status line reads ${JSON.stringify(seen.status)} rather than a count of results`);
  }

  return failures;
}

/** No page may scroll sideways at 320px.
 *
 *  Run over the same URLs the accessibility gate checks, which is one page per template plus every
 *  listing, and is guarded against coming out short in `pa11yUrls`. So a new category is covered
 *  here the day it exists, for the same reason it is covered there. */
async function checkNarrowLayout(page: Page, urls: string[]): Promise<Failure[]> {
  const failures: Failure[] = [];
  await page.setViewport({ ...NARROW });

  for (const url of urls) {
    await page.goto(url, { waitUntil: "load" });
    const overflow = await page.evaluate((shown: number) => {
      const root = document.documentElement;
      const excess = root.scrollWidth - root.clientWidth;
      if (excess <= 0) return null;
      // Diagnostics rather than the assertion. An element inside an `overflow-x: auto` container
      // legitimately extends past the viewport and is clipped by its parent, so this can name an
      // inner element when the real culprit is the container that stopped scrolling. The document
      // scrolling is the defect; this is the hint about where.
      const culprits = [...document.body.querySelectorAll<HTMLElement>("*")]
        .map((el) => ({ el, right: el.getBoundingClientRect().right }))
        .filter((entry) => entry.right > root.clientWidth + 1)
        // Widest first, not document order. In document order the list is whatever sits nearest
        // the top of the page, which on every page here is the nav, whatever actually overflowed.
        .sort((a, b) => b.right - a.right)
        .slice(0, shown)
        .map(({ el, right }) => {
          // `className` is an SVGAnimatedString on an SVG element, so it is read as a string
          // rather than assumed to be one.
          const classes = typeof el.className === "string" ? el.className : "";
          const first = classes.split(" ")[0];
          const name = first ? `${el.tagName.toLowerCase()}.${first}` : el.tagName.toLowerCase();
          return `${name} reaches ${Math.round(right)}px`;
        });
      return { excess, width: root.scrollWidth, culprits };
    }, CULPRITS_SHOWN);

    if (overflow) {
      failures.push({
        check: `${new URL(url).pathname} at ${NARROW.width}px`,
        detail: [
          `scrolls ${overflow.excess}px sideways (document is ${overflow.width}px wide)`,
          ...overflow.culprits.map((culprit) => `  ${culprit}`),
        ].join("\n"),
      });
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const origin = process.argv[2] ?? LOCAL_ORIGIN;
  const sitemap = readFileSync(join(DIST_DIR, SITEMAP_FILE), "utf-8");
  const urls = pa11yUrls(sitemap, origin);

  // `--no-sandbox` for the same reason `.pa11yci.json` passes it: the CI runner and this
  // devcontainer both run as a user Chrome's sandbox will not start under.
  const browser: Browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  let failures: Failure[];
  try {
    const page = await browser.newPage();
    failures = [
      ...(await checkSearch(page, origin, indexedTerm(sitemap))),
      ...(await checkNarrowLayout(page, urls)),
    ];
  } finally {
    await browser.close();
  }

  if (failures.length) {
    for (const failure of failures) console.error(`browser-check: ${failure.check}\n  ${failure.detail}`);
    process.exit(1);
  }
  console.log(`browser-check: search works, and ${urls.length} page(s) fit ${NARROW.width}px`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
