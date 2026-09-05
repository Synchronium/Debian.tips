import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../src/content/loader.js";
import { pageSources } from "../src/content/sourcePaths.js";
import { readTimings } from "../src/content/replayTimings.js";
import { sourceLinks } from "../src/templates/partials/sourceLinks.js";
import { SITE, blobUrl } from "../src/config.js";
import { CONTENT_DIR, FIXTURE_DIR, ROOT } from "../src/paths.js";

/* Every page now links into the repository at the files that produced it, and neither gate
 * can see those links: `src/linkcheck.ts` walks `dist/` and resolves internal paths, and
 * `scripts/link-audit.ts` builds a graph of pages. Nothing fetches github.com, and nothing
 * should, so a renamed setup script or a page moved between categories would put a dead link
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

  it("reports a skip file exactly when one exists", () => {
    const wrong = model.pages.filter(
      (page) => page.sources.hasSkipFile !== existsSync(join(FIXTURE_DIR, `${page.slug}.skip`)),
    );
    expect(wrong.map((page) => page.url)).toEqual([]);
  });

  it("offers a replay time only for a page that has a recorded one", () => {
    // The estimate a reader is shown before running the command. Advisory, like the file it comes
    // from: a page added since the last recording says nothing rather than guessing, which on the
    // page whose subject is not claiming unchecked things is the only acceptable default.
    // Keyed `category/slug`, because slugs are unique per category and not site-wide: looking a
    // page up by slug alone would hand `/compare/x/` the time recorded for `/concepts/x/`.
    const timings = readTimings();
    const wrong = model.pages.filter((page) => {
      const expected = page.sources.replayable ? timings[`${page.category}/${page.slug}`] : undefined;
      return page.sources.replaySeconds !== expected;
    });
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
 * exercised against a slug that has no page, or it would be untested until the day it
 * first mattered, which is the day someone writes a page ahead of its fixture.
 *
 * The expected path is assembled from the slug rather than written out, because
 * `test/documentedPaths.test.ts` scans this file for paths and would report a literal one, quite
 * correctly, as naming a file that does not exist. */
describe("a page with no setup script", () => {
  const slug = "a-page-with-no-fixture-yet";

  it("is not marked replayable and lists only its own source", () => {
    const sources = pageSources("concepts", slug);
    expect(sources.replayable).toBe(false);
    expect(sources.hasSkipFile).toBe(false);
    expect(sources.files.map((file) => file.path)).toEqual([`content/concepts/${slug}.md`]);
  });
});

/* The block tells a reader where the reason for an exemption is written. A command page records
 * it in `scripts/fixtures/<slug>.skip`, which is listed among the files; a prose page records it
 * inline, in a comment the Markdown pipeline strips before rendering, so the only place a reader
 * can see it is the page source, also listed. Getting that backwards sends them after a file
 * that does not exist, on the one block whose job is to make the claim checkable.
 *
 * Asserted against the rendered page rather than against `checksSentence`, because the failure
 * is a sentence naming a file that is not in the list beside it. */
describe("where the block says an exemption is explained", () => {
  const rendered = model.pages
    .filter((page) => page.checks.exempt > 0)
    .map((page) => ({ page, html: sourceLinks(page.slug, page.sources, page.checks) }));

  it("has pages of both kinds to check", () => {
    expect(rendered.some(({ page }) => page.sources.hasSkipFile)).toBe(true);
    expect(rendered.some(({ page }) => !page.sources.hasSkipFile)).toBe(true);
  });

  it("names the skip file only when the page lists one", () => {
    const wrong = rendered
      .filter(({ page, html }) => html.includes("the skip file above") !== page.sources.hasSkipFile)
      .map(({ page }) => page.url);
    expect(wrong).toEqual([]);
  });

  it("always points at a file the reader can actually open", () => {
    for (const { page, html } of rendered) {
      const [where, named] = page.sources.hasSkipFile
        ? ["the skip file above", `${page.slug}.skip`]
        : ["the page source above", `${page.slug}.md`];
      expect(html, `${page.url} does not say where the reason is`).toContain(where);
      const listed = page.sources.files.some((file) => file.path.endsWith(named));
      expect(listed, `${page.url} points at ${named}, which it does not list`).toBe(true);
    }
  });
});

/* The sentence a page states about how strictly it is checked. The three figures partition the
 * checked total, so a reader adding up "25 exactly" and what follows it must arrive at the total
 * beside them. Rendered rather than called directly, since `checksSentence` is not exported and
 * the punctuation between the clauses is part of what is asserted. */
describe("what the block says is compared how", () => {
  const say = (checks: Partial<Parameters<typeof sourceLinks>[2]>) =>
    sourceLinks("grep", pageSources("commands", "grep", FIXTURE_DIR), {
      checked: 0,
      byShape: 0,
      unordered: 0,
      exempt: 0,
      fixtures: 0,
      ...checks,
    });

  it("says so plainly when nothing is relaxed", () => {
    expect(say({ checked: 12 })).toContain("Checks 12 outputs, all compared exactly.");
  });

  it("splits off the shape-compared ones", () => {
    expect(say({ checked: 12, byShape: 4 })).toContain("Checks 12 outputs: 8 exactly and 4");
  });

  it("splits off the ones whose order is not a claim", () => {
    expect(say({ checked: 12, unordered: 3 })).toContain("Checks 12 outputs: 9 exactly and 3");
  });

  it("lists all three with a comma and one and", () => {
    const html = say({ checked: 12, byShape: 4, unordered: 3 });
    expect(html).toContain("Checks 12 outputs: 5 exactly, 4");
    expect(html).toContain("by shape</a> and 3");
  });

  it("never opens with a count of zero", () => {
    // A page can have every output relaxed: `recipes/kill-whatever-is-using-a-port` shows two
    // `lsof` listings whose PIDs and column padding belong to the machine. "0 exactly" reads as an
    // admission on the one sentence that exists to describe what was checked.
    const shaped = say({ checked: 2, byShape: 2 });
    expect(shaped).not.toContain("0 exactly");
    expect(shaped).toContain("Checks 2 outputs, all compared <a");
    expect(shaped).toContain(">by shape</a>.");
  });

  it("names the comparison, not `exactly`, when the single survivor is a relaxed one", () => {
    // The one-clause branch used to assume the survivor was the exact count, so a wholly
    // unordered page would have claimed the strictest comparison it is not held to.
    expect(say({ checked: 5, unordered: 5 })).toContain("all compared <a");
    expect(say({ checked: 5, unordered: 5 })).toContain(">in any order</a>.");
  });

  it("links each relaxation to the part of /about/ that explains it", () => {
    // Both land on one section, which covers a value that moves and an order that moves as two
    // kinds of the same problem. `linkcheck` fails on an anchor with no heading behind it, so a
    // rename on that page is caught rather than shipped as a link to the top of it.
    const html = say({ checked: 12, byShape: 4, unordered: 3 });
    expect(html).toContain(">by shape</a>");
    expect(html).toContain(">in any order</a>");
    expect(html.match(/\/about\/#output-that-cannot-be-identical/g)).toHaveLength(2);
  });
});
