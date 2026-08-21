import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../src/content/loader.js";
import { pageSources } from "../src/content/sourcePaths.js";
import { SITE, blobUrl } from "../src/config.js";
import { CONTENT_DIR, FIXTURE_DIR, ROOT } from "../src/paths.js";

/* Every page now links into the repository at the files that produced it, and neither gate
 * can see those links: `src/linkcheck.ts` walks `dist/` and resolves internal paths, and
 * `scripts/link-audit.ts` builds a graph of pages. Nothing fetches github.com, and nothing
 * should — so a renamed setup script or a page moved between categories would put a dead link
 * on every page it appears on, silently, on a site whose whole argument is that the claims are
 * checked. This is the gate that stands in for the one a link checker cannot run. */

const model = await loadContent(CONTENT_DIR, FIXTURE_DIR);

describe("the source files each page links to", () => {
  it("names a real file for every page", () => {
    const missing = model.pages.flatMap((page) =>
      page.sources.files
        .filter((file) => !existsSync(join(ROOT, file.path)))
        .map((file) => `${page.url} -> ${file.path}`),
    );
    expect(missing).toEqual([]);
  });

  it("gives every page at least its own source", () => {
    const empty = model.pages.filter((page) => page.sources.files.length === 0).map((page) => page.url);
    expect(empty).toEqual([]);
  });

  it("uses repository-relative paths, never absolute ones or a leading ./", () => {
    const paths = model.pages.flatMap((page) => page.sources.files.map((file) => file.path));
    expect(paths.filter((path) => path.startsWith("/") || path.startsWith("."))).toEqual([]);
    // A Windows separator here would resolve on disk and 404 on GitHub, which is the one
    // failure mode `existsSync` above cannot catch.
    expect(paths.filter((path) => path.includes("\\"))).toEqual([]);
  });

  it("claims a page is replayable exactly when its setup script exists", () => {
    const wrong = model.pages.filter(
      (page) => page.sources.replayable !== existsSync(join(FIXTURE_DIR, `${page.slug}.sh`)),
    );
    expect(wrong.map((page) => page.url)).toEqual([]);
  });

  it("lists the setup script and the skip file when a page has them", () => {
    const replayed = model.pages.filter((page) => page.sources.replayable);
    expect(replayed.length).toBeGreaterThan(0);
    for (const page of replayed) {
      expect(page.sources.files.map((file) => file.path)).toContain(`scripts/fixtures/${page.slug}.sh`);
    }
    const withSkips = model.pages.filter((page) => existsSync(join(FIXTURE_DIR, `${page.slug}.skip`)));
    expect(withSkips.length).toBeGreaterThan(0);
    for (const page of withSkips) {
      expect(page.sources.files.map((file) => file.path)).toContain(`scripts/fixtures/${page.slug}.skip`);
    }
  });

  it("builds a blob URL under the configured repository", () => {
    expect(blobUrl("content/about.md")).toBe(`${SITE.repo}/blob/main/content/about.md`);
    expect(SITE.repo.endsWith("/")).toBe(false);
  });
});

/* The about page's "Read it yourself" links are Markdown, so they are not built from `SITE.repo`
 * and cannot be. This is what stops the two drifting: the repository moving would otherwise
 * update 50 generated blocks and leave three hand-written links pointing at the old one. */
describe("repository links written by hand in content", () => {
  it("all sit under SITE.repo", () => {
    const sources = ["about.md"].map((file) => readFileSync(join(CONTENT_DIR, file), "utf-8"));
    const found = sources.flatMap((text) =>
      [...text.matchAll(/https:\/\/github\.com\/[A-Za-z0-9._/-]+/g)].map((m) => m[0]),
    );
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((url) => !url.startsWith(SITE.repo))).toEqual([]);
  });
});

/* A page with no setup script has to say so rather than printing a replay command that would
 * report it as unverified. Nothing in `content/` is in that state today, so the branch is
 * exercised against a slug that has no page — otherwise it would be untested until the day it
 * first mattered, which is the day someone writes a page ahead of its fixture.
 *
 * The expected path is assembled from the slug rather than written out, because
 * `test/repoPaths.test.ts` scans this file for paths and would report a literal one — quite
 * correctly — as naming a file that does not exist. */
describe("a page with no setup script", () => {
  const slug = "a-page-with-no-fixture-yet";

  it("is not marked replayable and lists only its own source", () => {
    const sources = pageSources("concepts", slug);
    expect(sources.replayable).toBe(false);
    expect(sources.files.map((file) => file.path)).toEqual([`content/concepts/${slug}.md`]);
  });
});
