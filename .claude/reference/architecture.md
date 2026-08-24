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

`src/html.ts` exports a tagged template `html` and a `raw()` wrapper: an interpolation like
`` html`<p>${value}</p>` `` auto-escapes `value` unless it's wrapped in `raw(...)`, arrays are
joined with no separator, and `null`/`undefined`/`false` render as empty string. Every template in
`src/templates/` composes through this. Never string-concatenate content into HTML directly, or
escaping breaks.

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
`scripts/fixtures/` (via `chokidar`, 150ms debounced), then serves the freshly-written static
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

`scripts/link-audit.ts` asks the question linkcheck doesn't: not whether the links that exist
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

`.github/workflows/ci.yml` runs two kinds of job in parallel, on every PR and push to `main`:

- `check`: format, typecheck (both configs), tests, build, pagefind, linkcheck, link audit, then
  `pa11y-ci` against the built site. Exactly what `npm run check` runs locally.
- `replay`, as four sharded jobs on four runners: the examples, for real, each page in a Docker
  sandbox of its own. A PR replays what its diff touched; a push to `main` replays everything.
  Which shard takes which page is `scripts/lib/replayShard.ts`, balanced from recorded timings
  and held to covering every page by `test/replayShard.test.ts`.

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on `workflow_run` of
CI, gated on the whole workflow succeeding and pinned to the same commit. All of it runs on
GitHub-hosted runners, independent of this repo's devcontainer. ADR-0003 is the topology and why;
`.claude/skills/ship/SKILL.md` is what to do when one goes red.
