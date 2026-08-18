// Where things are in this repository. Shared by the generator under `src/` and the replay
// harness under `scripts/`, because both address the same directories and were each computing
// their own answer.
//
// `ROOT` in particular was worked out independently in four files with the same expression,
// which is relative to the file holding it — so all four were right only because all four sat
// directly under `src/`, and moving any one of them a level deeper would have changed what it
// meant in that file alone.
//
// Site *configuration* does not belong here (see `src/config.ts`) and neither does the content
// contract (see `src/content/schema.ts`). This file answers "where", nothing else.
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root. This file lives in `src/`, so the root is one level up. */
export const ROOT = fileURLToPath(new URL("..", import.meta.url));

export const CONTENT_DIR = join(ROOT, "content");
export const DIST_DIR = join(ROOT, "dist");
export const PUBLIC_DIR = join(ROOT, "public");
export const STYLES_DIR = join(ROOT, "styles");

/** Setup scripts, `.skip` lists and the Python helpers a page's examples need. */
export const FIXTURE_DIR = join(ROOT, "scripts", "fixtures");

/** Starts and stops a disposable container. Absolute, so a tool that runs it does not depend
 *  on having been started from the repository root. */
export const SANDBOX_SCRIPT = join(ROOT, "scripts", "sandbox.sh");

/** A page's setup script: creates its sample files, and is what opts it into the replay. */
export const fixtureScript = (slug: string): string => join(FIXTURE_DIR, `${slug}.sh`);

/** Examples a batch cannot reproduce, listed by title with a note on how each was checked. */
export const skipFile = (slug: string): string => join(FIXTURE_DIR, `${slug}.skip`);

/** A command page is a directory holding prose and examples; every other page is one file. */
export const commandDir = (slug: string, contentDir: string = CONTENT_DIR): string =>
  join(contentDir, "commands", slug);
export const proseSource = (category: string, slug: string, contentDir: string = CONTENT_DIR): string =>
  join(contentDir, category, `${slug}.md`);

/** Filenames fixed by the content contract rather than by configuration. */
export const INDEX_FILE = "index.md";
export const EXAMPLES_FILE = "examples.yaml";
export const TAGS_FILE = "tags.yaml";
