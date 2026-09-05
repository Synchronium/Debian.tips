# How the generator is put together

*Decisions* about the generator, what was chosen and what it rules out, are recorded in
`docs/adr/`. This document is the mechanism; that one is the reasoning.

Reference, not a checklist. Read this when changing `src/`: the content pipeline, the
templates, the markdown rendering, the dev server or the link audit. Writing or verifying a
content page needs none of it.

## Content pipeline

`src/content/loader.ts` is the center of the system: it reads `content/`, validates every page's
frontmatter against `src/content/schema.ts` (Zod, the single source of truth for what a page or
example needs), and fails the build with a specific `ContentError` for the first problem found.
The validation order matters and is layered: schema shape → every `tags:` entry exists in
`content/tags.yaml` → slugs are unique across categories → `related:` targets actually exist →
(scripting only) `order:` values are unique. `related:` links are validated at build time, not
just documented, so a typo'd slug fails the build rather than silently 404ing.

The categories are whatever `CATEGORIES` in `src/content/schema.ts` says; read them there
rather than from a list here, which is how this document came to name five of them for months
after `troubleshooting` and `compare` were added. All but `commands` are flat
`content/<category>/<slug>.md` files. `commands` is special-cased: each command is a directory,
`content/commands/<slug>/index.md` (frontmatter + prose) paired with
`content/commands/<slug>/examples.yaml` (structured sections of tested examples). `loader.ts`'s
`loadCommands` requires both files to exist and cross-checks the examples file's `command:` field
against the directory name.

Two fields on every `Page` come from beside the loader rather than from frontmatter.
`src/content/sourcePaths.ts` derives which files in this repository produced the page, and
`src/content/pageChecks.ts` counts what `npm run replay -- <slug>` will check on it; both are
rendered at the foot of the page by `src/templates/partials/sourceLinks.ts`, and the same counting
feeds the about page's totals via `src/content/verificationStats.ts`. ADR-0017 has the reasoning.

`src/build.ts` orchestrates: load content → render every page through `src/templates/` → write
`dist/`. Rendering finishes before anything is written, because the stylesheet carries the
syntax-highlighting classes cut from the rendered pages (`src/content/shikiStyles.ts`) and is
content-hashed, so no page can be given its stylesheet link until the last page is rendered. Category listing pages, tag pages, the homepage, sitemap, and RSS feed are all generated
from the same loaded content model, not authored separately.

## `src/content/` is shared with the harness

`src/content/` is not only the generator's. It is the contract the generator and the replay harness
both read, and the dependency runs one way: `scripts/` imports from `src/`, and `src/` never imports
from `scripts/` (ADR-0028, held by `test/moduleBoundary.test.ts`).

That is why a directory named for the content holds files named for replaying it. `schema.ts` says
what a page may contain, `pageChecks.ts` partitions its outputs into checked and exempt,
`proseBlocks.ts` pairs a prose page's command fences to their output, `replaySkips.ts` reads the
exemption list and `replayTimings.ts` reads the recorded seconds. Each has two readers with the
same question, and one answer between them: the harness decides what to run, the build states the
figures at the foot of the page and sums them onto `/about/`.

A module only the harness needs stays in `scripts/lib/`, whichever half calls it more. The test is
whether the *build* needs the same answer. `scripts/lib/normalise.ts` decides what counts as a match
between two runs and the build has no opinion about that, so it stays in the harness.

Two fields on each example, `level` and `tags`, are validated but intentionally **not rendered
by any template yet** (reserved for a future difficulty badge / filter; see the comments on
`exampleSchema`). They look like dead data and aren't: keep authoring them accurately rather than
stripping them.

## Command page grouping is not frontmatter-driven

The `/commands/` listing page groups pages by topic (text processing, files & directories,
networking, etc.) using a static lookup table, `COMMAND_GROUPS` in `src/config.ts`, not a
frontmatter field. A new command page that isn't added to the matching group there falls through
to a "More commands" catch-all group instead of its logical section. `COMMAND_GROUPS` also
doubles as a running list of command slugs the site intends to eventually cover, well beyond what
currently has content, which is useful as a roadmap hint but not a guarantee those pages exist yet
(check `content/commands/` for what's actually written).

## HTML generation

`src/html.ts` exports a tagged template `html`, which returns a `Raw`: an interpolation like
`` html`<p>${value}</p>` `` escapes `value` unless it is already `Raw`, arrays are joined with no
separator, and `null`/`undefined`/`false` render as empty string. Every template in
`src/templates/` composes through this and returns `Raw` itself, so a nested template needs no
wrapper. `src/build.ts` takes `.value` at the point it writes a page, and that is the only place
the markup becomes an ordinary string.

Three helpers go with it, and each exists because the obvious alternative silently escapes markup:

- `raw(string)` promotes text this module did not produce. Reserve it for exactly that: rendered
  Markdown, Shiki's output, an attribute fragment. A `raw()` in a template is a claim that
  something external is being trusted, so it should be rare enough to read as one.
- `joinHtml(parts, separator)` joins fragments with punctuation between them. `Array.join` returns
  a plain string, which the next interpolation escapes.
- `EMPTY_HTML` is what a partial returns when it has nothing to render, keeping the return type
  `Raw` rather than widening it to `Raw | string`.

Never string-concatenate content into HTML directly, or escaping breaks.

## Markdown rendering

`src/content/markdown.ts` runs a remark/rehype pipeline (GFM, heading slugs + autolinks, a custom
plugin turning `> [!NOTE]`/`[!TIP]`/`[!WARNING]`/`[!DANGER]` blockquotes into `<aside>` callouts)
and highlights fenced code blocks with Shiki in both light and dark themes at once. Two
`github-light` token colors are manually patched post-render (`LIGHT_CONTRAST_FIXES`) because they
fail WCAG AA against this site's light background, verified with pa11y-ci; don't remove that fix
without re-checking contrast.

## Inline markdown in short fields

Most template interpolation is escaped plain text, but three short prose fields on command pages
(an example's `description`, a section's `intro`, a fixture's `note`) go through
`renderInline()` in `src/content/markdown.ts`, which runs the same remark parser as page prose and
strips the wrapping `<p>`. That's what makes a backticked flag render monospaced instead of
shipping literal backticks. It deliberately rejects block-level content (a blank line, a leading
`- `) with a build error naming the field, because a `<ul>` inside the `<p>` these render into is
invalid HTML that linkcheck wouldn't catch. Raw HTML is dropped rather than passed through.

Everything else (`title`, `tagline`, frontmatter `description`) is still plain text, and must
stay that way: frontmatter `description` also feeds `<meta name="description">` and JSON-LD.

## Dev server

`src/server.ts` is a plain `node:http` server over `dist/`, not a bundler dev server. It does a
full `build()` on startup and on every change under `content/`, `src/`, `styles/`, `public/` or
`scripts/fixtures/` (via `chokidar`, briefly debounced), then serves the freshly-written static
files. No HMR. `scripts/fixtures/` is watched because the about page's figures are counted from
it: adding or removing a setup script changes what the built site claims about itself.

## Tests

`test/build.test.ts` runs the entire build pipeline (`build()` from `src/build.ts`) against
`test/fixtures/content/` (a small isolated content tree, not the real `content/`) into a temp
dir, then asserts on the emitted HTML. Other test files unit-test individual pieces
(`schema.test.ts`, `markdown.test.ts`, `html.test.ts`, `exampleCard.test.ts`). `src/linkcheck.ts`
is a separate post-build static check (not a vitest test) that walks every emitted HTML file,
extracts `href`/`src` attributes, and verifies internal links resolve to real files and `#fragment`
links resolve to a real `id` in the target page. Part of `npm run check`, not `npm test`.

## The link audit

`scripts/gates/link-audit.ts` asks the question linkcheck doesn't: not whether the links that exist
resolve, but whether the ones that should exist do. It builds a graph from `related:` frontmatter
plus every root-relative link in prose, example descriptions, section intros and fixture notes,
then reports pages nothing links to (**orphaned**), pages linking to fewer than two others
(**thin**), and pages reachable from exactly one (**weakly linked**). The first two fail the
build; the third prints as a count unless you pass `--verbose`, since the gate runs this on every
push and an advisory list nobody reads is worse than no list.

A new page is an orphan by construction, since nothing knew it was coming, and until this existed
nothing in the repo noticed. Drafts are exempt from both defect checks, because the loader already
rejects a published page linking to a draft, so a draft could never be anything but an orphan.

The graph itself lives in `scripts/lib/linkGraph.ts` and is covered by `test/linkGraph.test.ts`,
on the same reasoning as `normalise.ts`: a missing edge invents an orphan, which is noisy but
visible, while an invented edge hides a real one behind a clean report. Heading anchors
(`href="#flags"`, which rehype-autolink-headings puts on every `##`) and self-links are the two
that would do it, and both are pinned by a test.

`.claude/skills/cross-link-pages/SKILL.md` is the editorial half: what to do with the report,
and why the fix is almost always an inline link on the sentence that raises the question rather
than another `related:` entry.

## CI/deploy

`.github/workflows/ci.yml` runs two kinds of job in parallel, on every PR and push to `main`, and
they are the whole of what gates a deploy:

- `check`: format, typecheck (both configs), tests, build, pagefind, linkcheck, link audit, then
  `pa11y-ci` against the built site. Exactly what `npm run check` runs locally.
- `replay`, as sharded jobs one runner each: the examples, for real, each page in a Docker
  sandbox of its own. A PR replays what its diff touched; a push to `main` replays everything.
  Which shard takes which page is `scripts/lib/replayShard.ts`, balanced from recorded timings
  and held to covering every page by `test/replayShard.test.ts`. Whether the count in the matrix
  is still the one those timings justify is `npm run shards`, reported rather than gated, for the
  reason ADR-0023 gives. The matrix is the only place the count is written.

`.github/workflows/drift.yml` replays the whole site weekly on a schedule, serially on one
runner. It gates nothing; it is there because Debian's archive moves without a commit, and a push
to `main` is the only other thing that would notice. Kept out of `ci.yml` on purpose: Deploy keys
off a CI conclusion, so a scheduled one would publish the site on a timer.

`.github/workflows/record-timings.yml` re-records those timings after a green push to `main`, from
the replay that just ran, and commits them. Also kept out of `ci.yml` on purpose, and for a second
reason on top of drift's: Deploy waits for CI's last job, so a recorder in there would delay every
deploy and could fail one over an artifact. ADR-0023, and `scripts/maintain/merge-timings.ts` is what
decides whether the figures are worth a commit.

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on `workflow_run` of
CI, gated on the whole workflow succeeding and pinned to the same commit. All of it runs on
GitHub-hosted runners, independent of this repo's devcontainer. ADR-0003 is the topology and why;
`.claude/skills/ship/SKILL.md` is what to do when one goes red.
