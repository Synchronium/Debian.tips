import { describe, expect, it } from "vitest";
import { pagesTouchedBy } from "../scripts/lib/changedPages.js";

/* The two mistakes this can make cost different things, and only one of them is visible.
 *
 * Selecting too many pages costs a pull request some minutes. Selecting too few means a branch
 * changes a page and CI replays something else, reporting green over the edit nobody checked. So
 * the harness-wide cases below are the ones worth being sure about. */

describe("which pages a diff selects", () => {
  it("takes a command page from its directory", () => {
    expect(pagesTouchedBy(["content/commands/wget/examples.yaml"])).toEqual(["wget"]);
    expect(pagesTouchedBy(["content/commands/wget/index.md"])).toEqual(["wget"]);
  });

  it("takes a prose page from its filename, whatever its category", () => {
    expect(pagesTouchedBy(["content/recipes/find-the-largest-files.md"])).toEqual(["find-the-largest-files"]);
    expect(pagesTouchedBy(["content/concepts/pipes-and-redirection.md"])).toEqual(["pipes-and-redirection"]);
  });

  it("takes a page from its setup script or its skip list", () => {
    expect(pagesTouchedBy(["scripts/fixtures/tar.sh"])).toEqual(["tar"]);
    expect(pagesTouchedBy(["scripts/fixtures/tail.skip"])).toEqual(["tail"]);
  });

  it("names each page once however many of its files changed", () => {
    expect(
      pagesTouchedBy([
        "content/commands/ls/index.md",
        "content/commands/ls/examples.yaml",
        "scripts/fixtures/ls.sh",
      ]),
    ).toEqual(["ls"]);
  });

  it("selects nothing for a change that touches no page", () => {
    expect(pagesTouchedBy(["README.md", "styles/site.css", "src/templates/home.ts"])).toEqual([]);
  });

  it("selects nothing at all for an empty diff", () => {
    expect(pagesTouchedBy([])).toEqual([]);
  });
});

describe("what puts every page back in", () => {
  /* `src/content/` holds the fence-pairing rule, the partition, the exemption parser and the
   * comparison vocabulary. A mis-paired fence reports as "not checkable" rather than as broken, so
   * a pull request touching the rule and replaying nothing loses the signal silently. */
  it("a change under src/content/, which the replay reads its rules from", () => {
    expect(pagesTouchedBy(["src/content/proseBlocks.ts"])).toBe("all");
    expect(pagesTouchedBy(["src/content/pageChecks.ts"])).toBe("all");
  });

  it("a change to the harness or to the image pages run in", () => {
    expect(pagesTouchedBy(["scripts/lib/normalise.ts"])).toBe("all");
    expect(pagesTouchedBy(["scripts/replay/command-page.ts"])).toBe("all");
    expect(pagesTouchedBy(["scripts/replay/sandbox/Dockerfile"])).toBe("all");
  });

  it("a change to the fixture bodies every page shares", () => {
    expect(pagesTouchedBy(["scripts/fixtures/_common.sh"])).toBe("all");
  });

  it("a change to a Python helper a page's examples talk to", () => {
    expect(pagesTouchedBy(["scripts/fixtures/http-mock.py"])).toBe("all");
  });

  it("even when a one-page change is in the same diff", () => {
    expect(pagesTouchedBy(["content/commands/wget/index.md", "scripts/lib/normalise.ts"])).toBe("all");
  });

  /* The counterpart: a page's own setup script must not read as harness-wide just because it sits
   * under scripts/fixtures/ beside the file that is. */
  it("but not an ordinary setup script under the same directory", () => {
    expect(pagesTouchedBy(["scripts/fixtures/wget.sh"])).toEqual(["wget"]);
  });
});
