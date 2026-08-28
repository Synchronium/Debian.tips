// Where things are in this repository. Shared by the generator under `src/` and the replay
// harness under `scripts/`: both address the same directories, and a second opinion about where
// something lives is a second opinion that can be wrong.
//
// `ROOT` is computed once, here, because the expression is relative to the file holding it, and a
// copy in a file one level deeper means something different while looking identical.
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

/** The site's client-side TypeScript, compiled by esbuild at build time (ADR-0013).
 *
 *  Most of it is inlined into every page by `src/templates/layout.ts`, because it has to run
 *  before first paint. `search.ts` is the exception and is compiled to a file instead, since it
 *  pulls in Pagefind and should not load for a visitor who never searches; `src/assets.ts` writes
 *  it out. Both are build inputs, which is why they are here rather than under `public/`, where
 *  a file is copied to `dist/` unread and unchecked. */
export const CLIENT_DIR = join(ROOT, "src", "client");

/** Setup scripts, `.skip` lists and the Python helpers a page's examples need. */
export const FIXTURE_DIR = join(ROOT, "scripts", "fixtures");

/** The one webfont the site serves: Source Serif 4, Latin subset, semibold, used for headings
 *  and nothing else. Taken from the npm package rather than committed as a binary, so the version
 *  is in `package.json` where Dependabot can see it.
 *
 *  Served under a fixed name rather than a content hash, unlike the stylesheet. The stylesheet has
 *  to name this URL, so hashing the font would mean substituting the hash into the CSS before
 *  hashing *that*, leaving `styles/site.css` something other than a stylesheet. The file changes
 *  only when the package does; when it does, change the name here. */
export const FONT_SOURCE = join(
  ROOT,
  "node_modules",
  "@fontsource",
  "source-serif-4",
  "files",
  "source-serif-4-latin-600-normal.woff2",
);
export const FONT_FILE = "source-serif-4-latin-600.woff2";
export const FONT_HREF = `/assets/${FONT_FILE}`;

/** The share card every page points social media at, copied out of `public/` by the asset step
 *  like any other static file. Named here because two things address it: the `og:image` and
 *  `twitter:image` tags in the layout, and `scripts/og-image.ts`, which draws it. */
export const OG_IMAGE_FILE = "og-default.png";
export const OG_IMAGE_HREF = `/${OG_IMAGE_FILE}`;

/** Filenames fixed by the content contract rather than by configuration. */
export const PAGE_EXTENSION = ".md";
export const INDEX_FILE = "index.md";
export const EXAMPLES_FILE = "examples.yaml";
export const TAGS_FILE = "tags.yaml";

/** What the build writes into `dist/`, named here because more than one thing addresses each:
 *  the builder writes them, the dev server serves them, linkcheck resolves links to them and the
 *  accessibility gate reads the sitemap. Several spellings of one convention is how they drift. */
export const OUTPUT_INDEX = "index.html";
export const NOT_FOUND_FILE = "404.html";
export const SITEMAP_FILE = "sitemap.xml";
export const FEED_FILE = "feed.xml";

/** The accessibility gate's settings, hand-maintained, and the file `scripts/pa11y-urls.ts`
 *  writes beside it holding those settings plus the URL list it computes from the built sitemap.
 *
 *  Two files because they are two kinds of thing. The settings belong in git; the URL list is
 *  output, and output committed next to its own generator goes stale in the repository and dirties
 *  the working tree of anyone who runs the gate. The generated one is gitignored, and is what
 *  `npm run a11y` points `pa11y-ci` at, in CI and locally alike.
 *
 *  Splitting them made a bare `npx pa11y-ci` worse than useless: it reads the settings file, finds
 *  no `urls`, and reports a pass having checked nothing. `pa11y-urls.ts` refuses to write a list
 *  that is missing a category listing, since pa11y-ci itself will never object to a short one. */
export const PA11Y_CONFIG = join(ROOT, ".pa11yci.json");
export const PA11Y_GENERATED_CONFIG = join(ROOT, ".pa11yci.generated.json");

/** Starts and stops a disposable container. Absolute, so a tool that runs it does not depend
 *  on having been started from the repository root. */
export const SANDBOX_SCRIPT = join(ROOT, "scripts", "sandbox.sh");

/** What each page verified when it was last recorded. Compared by
 *  `test/verificationBaseline.test.ts`, rewritten by `scripts/update-verification-baseline.ts`. */
export const VERIFICATION_BASELINE_FILE = join(ROOT, "test", "verification-baseline.json");

/** Seconds each page took on the last recorded full replay, used to balance `--shard`. Written by
 *  CI after a green run of the whole site, and by `npm run replay -- --record-timings` by hand,
 *  read by `scripts/lib/replayShard.ts`. Keyed `category/slug`, as the verification baseline is.
 *
 *  Advisory throughout: out of date, it balances worse; missing, every page still runs. Nothing
 *  reads it to decide *whether* a page is replayed. */
export const REPLAY_TIMINGS_FILE = join(ROOT, "scripts", "replay-timings.json");

/** The CI workflow, which is also where the number of replay shards is declared.
 *
 *  Read by `test/replayShard.test.ts`, which checks that count against the recorded timings. That
 *  test is the reason the workflow can state the number without also stating the measurements
 *  that justify it, which is what used to go stale beside it. */
export const CI_WORKFLOW_FILE = join(ROOT, ".github", "workflows", "ci.yml");

/** A page's setup script: creates its sample files, and is what opts it into the replay.
 *
 *  `fixtureDir` is a parameter for the same reason `contentDir` is one: a build over a synthetic
 *  content tree has a synthetic harness beside it, and defaulting to this repository's would have
 *  the build counting one tree's pages against another tree's setup scripts. */
export const fixtureScript = (slug: string, fixtureDir: string = FIXTURE_DIR): string =>
  join(fixtureDir, `${slug}.sh`);

/** Examples a batch cannot reproduce, listed by title with a note on how each was checked. */
export const skipFile = (slug: string, fixtureDir: string = FIXTURE_DIR): string =>
  join(fixtureDir, `${slug}.skip`);

/** A command page is a directory holding prose and examples; every other page is one file. */
export const commandsDir = (contentDir: string = CONTENT_DIR): string => join(contentDir, "commands");
export const commandDir = (slug: string, contentDir: string = CONTENT_DIR): string =>
  join(commandsDir(contentDir), slug);
export const proseSource = (category: string, slug: string, contentDir: string = CONTENT_DIR): string =>
  join(contentDir, category, `${slug}${PAGE_EXTENSION}`);

/** The slug a prose page's filename names, or null if the file is not a page at all. The inverse
 *  of `proseSource`, and the one place that knows a listing of a content directory contains files
 *  that are not pages. */
export function proseSlug(filename: string): string | null {
  return filename.endsWith(PAGE_EXTENSION) ? filename.slice(0, -PAGE_EXTENSION.length) : null;
}
