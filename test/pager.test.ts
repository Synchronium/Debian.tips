import { describe, expect, it } from "vitest";
import { paginate, paginationNav } from "../src/templates/partials/pager.js";

/* Pagination exists because a tag can accumulate every page on the site. The cases that matter
 * are the boundaries: a set that exactly fills one page must not emit an empty second one, and
 * the first slice must keep the listing's own URL, since a `/tags/apt/page/1/` would be a second URL
 * for a page that already has one. */

const items = (count: number): number[] => Array.from({ length: count }, (_unused, i) => i + 1);

describe("paginate", () => {
  it("returns one slice, at the base path, for a set that fits", () => {
    expect(paginate(items(5), "/tags/apt/", 24)).toEqual([
      { items: items(5), number: 1, total: 1, path: "/tags/apt/" },
    ]);
  });

  it("returns one slice when the set exactly fills a page", () => {
    const [only, ...rest] = paginate(items(24), "/tags/apt/", 24);
    expect(rest).toEqual([]);
    expect(only?.total).toBe(1);
    expect(only?.nextPath).toBeUndefined();
  });

  it("splits at the boundary and links the slices together", () => {
    const slices = paginate(items(25), "/tags/apt/", 24);
    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({
      number: 1,
      total: 2,
      path: "/tags/apt/",
      nextPath: "/tags/apt/page/2/",
    });
    expect(slices[0]?.prevPath).toBeUndefined();
    expect(slices[1]).toMatchObject({
      items: [25],
      number: 2,
      total: 2,
      path: "/tags/apt/page/2/",
      prevPath: "/tags/apt/",
    });
    expect(slices[1]?.nextPath).toBeUndefined();
  });

  it("emits a page for an empty set rather than nothing at all", () => {
    // A category with no pages still has a listing, which says the category is empty, and that is
    // information. Emitting nothing would leave the nav linking to a 404.
    expect(paginate([], "/recipes/", 24)).toEqual([{ items: [], number: 1, total: 1, path: "/recipes/" }]);
  });

  it("keeps everything on one page when asked for no limit", () => {
    // How `/commands/` is built: grouped by topic, never split.
    const slices = paginate(items(300), "/commands/", Infinity);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.items).toHaveLength(300);
  });
});

describe("paginationNav", () => {
  it("renders nothing for a listing that fits on one page", () => {
    expect(paginationNav(paginate(items(3), "/tags/apt/", 24)[0]!)).toBe("");
  });

  it("names the position and links both ways in the middle of a run", () => {
    const middle = paginate(items(60), "/tags/apt/", 24)[1]!;
    const html = paginationNav(middle);
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain('href="/tags/apt/"');
    expect(html).toContain('href="/tags/apt/page/3/"');
  });
});
