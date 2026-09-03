import { describe, expect, it } from "vitest";
import { Pa11yUrlsError, pa11yUrls } from "../scripts/pa11y-urls.js";
import { CATEGORY_META, NAV_ORDER, NOT_FOUND_PATH, TAGS_PATH } from "../src/config.js";

/* `pa11y-ci` cannot fail on a URL list that is too short. Given none at all it prints
 * "Running Pa11y on 0 URLs / 0/0 URLs passed" and exits 0, config file or no config file. So every
 * way the list can come out short ends in a green tick over nothing, and the generator is the only
 * place that can notice.
 *
 * Not hypothetical. Splitting the settings out of `.pa11yci.json` left the tracked file with no
 * `urls` key while two documented recipes still said `npx pa11y-ci`, which then checked nothing and
 * reported success. These assertions are what makes that state unreachable rather than something
 * to remember. */

const ORIGIN = "http://localhost:4321";
const loc = (path: string): string => `<loc>https://debian.tips${path}</loc>`;

/** A sitemap of the shape a real build produces: home, every category listing, a page under each,
 *  the tags index and one tag page. Built from `NAV_ORDER` so a new category is covered here the
 *  day it exists, which is the same reason the list itself is generated. */
function completeSitemap(): string {
  const perCategory = NAV_ORDER.flatMap((category) => [
    loc(CATEGORY_META[category].path),
    loc(`${CATEGORY_META[category].path}a-page/`),
  ]);
  return `<?xml version="1.0"?><urlset>${loc("/")}${perCategory.join("")}${loc(TAGS_PATH)}${loc(`${TAGS_PATH}apt/`)}</urlset>`;
}

describe("the accessibility URL list", () => {
  it("covers every category listing and a page under each", () => {
    const urls = pa11yUrls(completeSitemap(), ORIGIN);
    for (const category of NAV_ORDER) {
      expect(urls).toContain(`${ORIGIN}${CATEGORY_META[category].path}`);
      expect(urls).toContain(`${ORIGIN}${CATEGORY_META[category].path}a-page/`);
    }
  });

  it("adds the 404, which is a template and is deliberately not in the sitemap", () => {
    expect(pa11yUrls(completeSitemap(), ORIGIN)).toContain(`${ORIGIN}${NOT_FOUND_PATH}`);
  });

  it("takes one tag page and not the dozens", () => {
    const many = completeSitemap().replace(
      loc(`${TAGS_PATH}apt/`),
      [loc(`${TAGS_PATH}apt/`), loc(`${TAGS_PATH}files/`), loc(`${TAGS_PATH}search/`)].join(""),
    );
    const tagPages = pa11yUrls(many, ORIGIN).filter(
      (url) => url.startsWith(`${ORIGIN}${TAGS_PATH}`) && url !== `${ORIGIN}${TAGS_PATH}`,
    );
    expect(tagPages).toHaveLength(1);
  });

  it("refuses a list with a category listing missing", () => {
    // The failure that matters: a build that stopped emitting a listing, or a parse that broke.
    // Returning the short list would hand pa11y-ci something it checks happily and passes.
    const dropped = CATEGORY_META[NAV_ORDER[0]!].path;
    const short = completeSitemap().replace(loc(dropped), "");
    expect(() => pa11yUrls(short, ORIGIN)).toThrow(Pa11yUrlsError);
    expect(() => pa11yUrls(short, ORIGIN)).toThrow(dropped);
  });

  it("refuses a list with every listing present and no page under one of them", () => {
    // The half that fails on its own. A content page is recognised by the shape of its path, so a
    // change to the route shape empties the samples while leaving every listing in place, and the
    // list then covers the listing template and none of the page templates.
    const category = CATEGORY_META[NAV_ORDER[0]!].path;
    const short = completeSitemap().replace(loc(`${category}a-page/`), "");
    expect(() => pa11yUrls(short, ORIGIN)).toThrow(Pa11yUrlsError);
    expect(() => pa11yUrls(short, ORIGIN)).toThrow("a page from inside it");
  });

  it("refuses a sitemap it read nothing out of", () => {
    // The case that produced a green tick over zero pages, reached by pointing pa11y-ci at a
    // settings file with no `urls` in it.
    expect(() => pa11yUrls('<?xml version="1.0"?><urlset></urlset>', ORIGIN)).toThrow(Pa11yUrlsError);
  });
});
