// Which pages a diff touches, for the pull-request run.
//
// A page is in if its own content changed, if its setup script changed, or if anything shared by
// the harness changed, in which case every page is back in, because a change there can move any
// page's output. The full set still runs on `main`, so this only ever trades a slower signal for a
// faster one on the branch, never a missing one before deployment.
//
// The mapping from files to pages is pure and is where the interesting mistakes live, so it is
// separate from the git call that produces the file list.
import { execFileSync } from "node:child_process";

/** Paths whose change can move any page's result, so a diff touching one replays everything.
 *
 *  `src/content/` is here because the replay imports from it: the fence-pairing rule, the
 *  partition, the exemption parser and the comparison vocabulary all live there. Leaving it out
 *  meant a pull request touching the pairing rule replayed nothing at all, and a mis-paired fence
 *  reports as "not checkable" rather than as broken, so the loss was silent.
 *
 *  `scripts/replay/` covers the three replays and the sandbox image together. A change to how a
 *  page is put in a container, or to what the image contains, can move any output on the site. */
const HARNESS_WIDE_PREFIXES = ["scripts/lib/", "scripts/replay/", "src/content/"] as const;

/** The one file under `scripts/fixtures/` that belongs to every page rather than to one. */
const SHARED_FIXTURE = "scripts/fixtures/_common.sh";

function isHarnessWide(file: string): boolean {
  return (
    HARNESS_WIDE_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    file === SHARED_FIXTURE ||
    // The Python helpers a page's examples talk to, wherever they sit.
    file.endsWith(".py")
  );
}

/** Where a page's slug appears in a path: its command directory, its prose file, or the setup
 *  script and skip list that opt it into the replay. */
const PAGE_PATHS = [
  /^content\/commands\/([^/]+)\//,
  /^content\/[^/]+\/([^/]+)\.md$/,
  /^scripts\/fixtures\/([^/]+)\.(?:sh|skip)$/,
] as const;

/** The pages a set of changed files selects, or `"all"` when the change can move anything.
 *
 *  Pure, so `test/changedPages.test.ts` can hold the two mistakes that matter: a harness-wide path
 *  read as one page's, which would replay far too little, and a page path that matches nothing,
 *  which would replay a branch's own edit not at all. */
export function pagesTouchedBy(files: readonly string[]): string[] | "all" {
  if (files.some(isHarnessWide)) return "all";
  const touched = new Set<string>();
  for (const file of files) {
    for (const pattern of PAGE_PATHS) {
      const slug = pattern.exec(file)?.[1];
      if (slug !== undefined) touched.add(slug);
    }
  }
  return [...touched];
}

/** Every path the branch has changed against `base`, committed or not.
 *
 *  Uncommitted work is included so that running this locally over a page being written replays
 *  that page, rather than reporting that nothing changed. Throws if git cannot answer, which the
 *  caller turns into replaying everything: a diff that cannot be computed is not evidence that
 *  nothing needs checking. */
export function changedFiles(base: string): string[] {
  const git = (...args: string[]): string[] =>
    execFileSync("git", args, { encoding: "utf-8" })
      .split("\n")
      .filter((line) => line !== "");

  return [
    ...git("diff", "--name-only", `${base}...HEAD`),
    // `--porcelain=v1` prefixes each path with a two-character status and a space.
    ...git("status", "--porcelain=v1", "--untracked-files=all").map((line) => line.slice(3)),
  ];
}
