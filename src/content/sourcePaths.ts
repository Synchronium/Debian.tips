// Which files in this repository produced a given page.
//
// The site's claim is that every documented output was really produced by the command shown, so
// a reader has to be able to reach the evidence without knowing this repository's conventions.
// Every page carries the answer, and `test/sourceLinks.test.ts` checks the paths still resolve.
//
// Paths are relative to the repository root and always use forward slashes, because they are
// both a URL fragment (see `blobUrl` in src/config.ts) and a filesystem path the test resolves.
// `contentDir` and `fixtureDir` are parameters for the same reason they are on `fixtureScript`:
// a build over the synthetic tree in `test/fixtures/` has a synthetic harness beside it, and
// hardcoding this repository's would make every path on those pages wrong while still pointing
// at files that exist.
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
import { replayTimings } from "./replayTimings.js";
import type { Category } from "./schema.js";

/** One file, with what it is for. The label is what a reader sees beside the link: a bare list
 *  of four paths answers "where" without answering "which of these is the one I want". */
export interface SourceFile {
  path: string;
  label: string;
}

export interface PageSources {
  files: SourceFile[];
  /** Whether `scripts/fixtures/<slug>.sh` exists, the file that opts a page into the replay,
   *  and therefore whether `npm run replay -- <slug>` has anything to run. A page without one
   *  says so rather than printing a command that would report it as unverified. */
  replayable: boolean;
  /** Whether `scripts/fixtures/<slug>.skip` exists and is listed above. A command page records
   *  an exemption there; a prose page records it inline, in a comment the Markdown pipeline
   *  strips before a reader ever sees it. The two need different wording, and this is what
   *  `src/templates/partials/sourceLinks.ts` picks between them on. */
  hasSkipFile: boolean;
  /** Seconds this page took on the last recorded full replay, or undefined if it has no recorded
   *  time. Shown to a reader about to run the command, who otherwise cannot tell a page that
   *  takes a second from one that takes a minute.
   *
   *  Advisory here as everywhere else (see `REPLAY_TIMINGS_FILE`): a missing or stale figure
   *  costs the reader an inaccurate estimate and nothing else, so a page with no time simply
   *  does not offer one rather than guessing. */
  replaySeconds?: number | undefined;
}

/** Repository-root-relative, forward slashes on every platform. */
function repoPath(absolute: string): string {
  return relative(ROOT, absolute).split(sep).join("/");
}

export function pageSources(
  category: Category,
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
  const hasSkipFile = existsSync(skips);
  if (hasSkipFile) {
    files.push({ path: repoPath(skips), label: "examples the batch cannot run, and how each was checked instead" });
  }

  const recorded = replayTimings()[slug];
  return {
    files,
    replayable,
    hasSkipFile,
    ...(replayable && recorded !== undefined ? { replaySeconds: recorded } : {}),
  };
}
