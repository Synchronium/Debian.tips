import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pagesTouchedBy, porcelainPaths } from "../scripts/lib/changedPages.js";

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

  /* The harness asks `src/paths.ts` which setup script a page gets and which files in a content
   * directory are pages, so a change there decides what runs and not merely how fast. Its
   * neighbours in `src/` build the site and move nothing a page claims. */
  it("a change to src/paths.ts, which the harness addresses every file through", () => {
    expect(pagesTouchedBy(["src/paths.ts"])).toBe("all");
    expect(pagesTouchedBy(["src/build.ts"])).toEqual([]);
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

/* A rename is the one status line naming two paths, and the page that gained the files is the one
 * a run has to replay. The line's shape belongs to git, so it is taken from a real `git mv` in a
 * throwaway repository instead of being written out here and assumed. */
describe("a page renamed but not yet committed", () => {
  const repos: string[] = [];
  afterAll(() => {
    for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function renamedPageStatus(): string[] {
    const dir = mkdtempSync(join(tmpdir(), "debian-tips-rename-"));
    repos.push(dir);
    const git = (...args: string[]): string =>
      execFileSync("git", ["-C", dir, ...args], { encoding: "utf-8" });

    git("init", "-q", ".");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Test");
    mkdirSync(join(dir, "content", "commands", "ls"), { recursive: true });
    writeFileSync(join(dir, "content", "commands", "ls", "index.md"), "page\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    git("mv", "content/commands/ls", "content/commands/list");

    return git("status", "--porcelain=v1", "--untracked-files=all")
      .split("\n")
      .filter((line) => line !== "");
  }

  it("selects the page the files moved to, not only the one they left", () => {
    const paths = renamedPageStatus().flatMap(porcelainPaths);
    const selected = pagesTouchedBy(paths);

    expect(selected).not.toBe("all");
    expect([...(selected as string[])].sort()).toEqual(["list", "ls"]);
  });
});
