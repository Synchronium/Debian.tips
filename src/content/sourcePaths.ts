// Which files in this repository produced a given page.
//
// The site's claim is that every documented output was really produced by the command shown, and
// until this existed the route from a claim to its evidence was: read /about/, find the
// repository, work out where a page of that category lives, guess at the setup script's name.
// Four steps and a convention nobody outside the repository knows. Every page now carries the
// answer, and `test/sourceLinks.test.ts` checks the paths still resolve.
//
// Paths are relative to the repository root and always use forward slashes, because they are
// both a URL fragment (see `blobUrl` in src/config.ts) and a filesystem path the test resolves.
// `contentDir` and `fixtureDir` are parameters for the same reason they are on `fixtureScript`
// and `verificationStats`: a build over the synthetic tree in `test/fixtures/` has a synthetic
// harness beside it, and hardcoding this repository's would make every path on those pages wrong
// while still pointing at files that exist.
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  CONTENT_DIR,
  EXAMPLES_FILE,
  FIXTURE_DIR,
  INDEX_FILE,
  ROOT,
  commandDir,
  fixtureScript,
  proseSource,
  skipFile,
} from "../paths.js";

/** One file, with what it is for. The label is what a reader sees beside the link: a bare list
 *  of four paths answers "where" without answering "which of these is the one I want". */
export interface SourceFile {
  path: string;
  label: string;
}

export interface PageSources {
  files: SourceFile[];
  /** Whether `scripts/fixtures/<slug>.sh` exists — the file that opts a page into the replay,
   *  and therefore whether `npm run replay -- <slug>` has anything to run. A page without one
   *  says so rather than printing a command that would report it as unverified. */
  replayable: boolean;
}

/** Repository-root-relative, forward slashes on every platform. */
function repoPath(absolute: string): string {
  return relative(ROOT, absolute).split(sep).join("/");
}

export function pageSources(
  category: string,
  slug: string,
  contentDir: string = CONTENT_DIR,
  fixtureDir: string = FIXTURE_DIR,
): PageSources {
  const files: SourceFile[] =
    category === "commands"
      ? [
          { path: repoPath(join(commandDir(slug, contentDir), INDEX_FILE)), label: "the prose" },
          {
            path: repoPath(join(commandDir(slug, contentDir), EXAMPLES_FILE)),
            label: "every example, its description and its output",
          },
        ]
      : [{ path: repoPath(proseSource(category, slug, contentDir)), label: "the page" }];

  const setup = fixtureScript(slug, fixtureDir);
  const replayable = existsSync(setup);
  if (replayable) {
    files.push({ path: repoPath(setup), label: "the setup script that creates its sample data" });
  }

  const skips = skipFile(slug, fixtureDir);
  if (existsSync(skips)) {
    files.push({ path: repoPath(skips), label: "examples the batch cannot run, and how each was checked instead" });
  }

  return { files, replayable };
}
