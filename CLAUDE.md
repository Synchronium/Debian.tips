# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

debian.tips is a static site generator built from scratch in TypeScript (no framework): content
lives as Markdown + YAML, is validated against a Zod schema, rendered through hand-written HTML
template functions, syntax-highlighted with Shiki, and indexed for client-side search with
Pagefind. Output is plain HTML/CSS/JS deployed to GitHub Pages.

## Commands

```sh
npm install
npm run dev      # dev server at http://localhost:4321, full rebuild on any file change
npm run build    # one-off production build to dist/
npm test         # vitest run (unit + fixture-based build tests)
npm run check    # tsc --noEmit && vitest run && build && pagefind && linkcheck — the full gate
```

Run `npm run check` before treating any change as done — it's also what CI runs (`.github/workflows/ci.yml`), followed by `pa11y-ci` as a separate accessibility gate.

Single test file: `npx vitest run test/schema.test.ts`
Single test by name: `npx vitest run -t "accepts a valid command page"`

Accessibility check locally (matches CI): build, serve `dist/`, then run pa11y-ci against it —
`npm run build && npx serve -l 4321 dist & npx wait-on http://localhost:4321 && npx pa11y-ci`.

There is no lint script/config in this repo — `tsc --noEmit` (strict mode, plus
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`noImplicitOverride`) is the only static
check beyond tests.

### Testing content examples for real

Every example on a command page is run for real, not written from memory — see
`.claude/skills/write-content-page/SKILL.md` for the full authoring checklist (structure, tiering,
style, verification steps). Command execution for that verification happens inside a disposable
Docker sandbox, not on the host:

```sh
name=$(scripts/sandbox.sh start)
scripts/sandbox.sh exec "$name" "<command to verify>"
scripts/sandbox.sh stop "$name"
```

This matters because verifying an example sometimes means installing a package, using `sudo`, or
standing up a real service (an `ssh` example needs a real `sshd`; a `crontab` example needs `cron`
actually running) — the sandbox container is thrown away afterward regardless, so none of that
persists on the devcontainer itself.

### Replaying examples to prove the outputs are real

A page's `output:` blocks are the site's core promise, and `npm run check` can't check them — it
validates shape, not truth. `scripts/verify-examples.mjs` replays every example on a page inside
the sandbox and diffs the real result against what the page claims:

```sh
name=$(scripts/sandbox.sh start)
node scripts/verify-examples.mjs "$name" wc scripts/fixtures/wc.sh   # -> "wc: 25/25 ..."
```

Each page's sample data lives twice, deliberately: as a `fixtures:` block in `examples.yaml`
(rendered on the page, collapsed) and as `scripts/fixtures/<command>.sh` (recreates those files in
the sandbox). The replay is what keeps the two honest. Fixtures are restored before *every*
example, because some legitimately mutate their input (`sed -i`, `sort -o`).

The replay checks the `fixtures:` blocks themselves too, not just the `output:` blocks: each one
is re-read from the sandbox and diffed, so a block that has drifted from its setup script fails
rather than quietly misleading a reader. By default that read is `cat <name>`. A block that isn't
one file's literal contents sets `from:` to the command that reproduces it — a directory shown as
`ls -lAR projects`, a 40-line file deliberately abridged to `head -3; echo …; tail -1`, control
bytes made visible with `sed "s/\r/␍/"`, or several files shown together with `tail -n +1 a b`.
The rule is that every rendered block is something a reader could actually produce; `from:` is
never rendered, it only keeps the block honest.

Every command page replays at 100% — 485 outputs across all sixteen. If you touch a
covered page, re-run its replay; if you add examples to an uncovered one, consider adding them.

Examples a batch can't replay (needing a concurrent writer or a network peer) are listed by title
in `scripts/fixtures/<command>.skip` with a note on how they were verified instead — they're
excluded explicitly rather than quietly failing.

The failure modes this has caught are written up in `.claude/skills/write-content-page/SKILL.md`
§4a. The most easily-missed: `wc`/`uniq -c` right-align their columns, and a plain YAML `|` block
silently strips that padding — such outputs need `output: |2`.

## Architecture

### Content pipeline

`src/content/loader.ts` is the center of the system: it reads `content/`, validates every page's
frontmatter against `src/content/schema.ts` (Zod — the single source of truth for what a page or
example needs), and fails the build with a specific `ContentError` for the first problem found.
The validation order matters and is layered: schema shape → every `tags:` entry exists in
`content/tags.yaml` → slugs are unique across categories → `related:` targets actually exist →
(scripting only) `order:` values are unique. `related:` links are validated at build time, not
just documented — a typo'd slug fails the build, it doesn't silently 404.

Five categories (`src/content/schema.ts` `CATEGORIES`): `commands`, `concepts`, `scripting`,
`recipes`, `debian`. All but `commands` are flat `content/<category>/<slug>.md` files. `commands`
is special-cased: each command is a directory, `content/commands/<slug>/index.md` (frontmatter +
prose) paired with `content/commands/<slug>/examples.yaml` (structured sections of tested
examples) — `loader.ts`'s `loadCommands` requires both files to exist and cross-checks the
examples file's `command:` field against the directory name.

`src/build.ts` orchestrates: load content → render each page through `src/templates/` → write
`dist/`. Category listing pages, tag pages, the homepage, sitemap, and RSS feed are all generated
from the same loaded content model, not authored separately.

Two fields on each example — `level` and `tags` — are validated but intentionally **not rendered
by any template yet** (reserved for a future difficulty badge / filter; see the comments on
`exampleSchema`). They look like dead data and aren't: keep authoring them accurately rather than
stripping them.

### Command page grouping is not frontmatter-driven

The `/commands/` listing page groups pages by topic (text processing, files & directories,
networking, etc.) using a static lookup table, `COMMAND_GROUPS` in `src/config.ts` — not a
frontmatter field. A new command page that isn't added to the matching group there falls through
to a "More commands" catch-all group instead of its logical section. `COMMAND_GROUPS` also
doubles as a running list of command slugs the site intends to eventually cover, well beyond what
currently has content — useful as a roadmap hint, but not a guarantee those pages exist yet
(check `content/commands/` for what's actually written).

### HTML generation

`src/html.ts` exports a tagged template `html` and a `raw()` wrapper: an interpolation like
`` html`<p>${value}</p>` `` auto-escapes `value` unless it's wrapped in `raw(...)`, arrays are
joined with no separator, and `null`/`undefined`/`false` render as empty string. Every template in
`src/templates/` composes through this — never string-concatenate content into HTML directly, or
escaping breaks.

### Markdown rendering

`src/content/markdown.ts` runs a remark/rehype pipeline (GFM, heading slugs + autolinks, a custom
plugin turning `> [!NOTE]`/`[!TIP]`/`[!WARNING]`/`[!DANGER]` blockquotes into `<aside>` callouts)
and highlights fenced code blocks with Shiki in both light and dark themes at once. Two
`github-light` token colors are manually patched post-render (`LIGHT_CONTRAST_FIXES`) because they
fail WCAG AA against this site's light background — verified with pa11y-ci; don't remove that fix
without re-checking contrast.

### Inline markdown in short fields

Most template interpolation is escaped plain text, but three short prose fields on command pages —
an example's `description`, a section's `intro`, a fixture's `note` — go through
`renderInline()` in `src/content/markdown.ts`, which runs the same remark parser as page prose and
strips the wrapping `<p>`. That's what makes a backticked flag render monospaced instead of
shipping literal backticks. It deliberately rejects block-level content (a blank line, a leading
`- `) with a build error naming the field, because a `<ul>` inside the `<p>` these render into is
invalid HTML that linkcheck wouldn't catch. Raw HTML is dropped rather than passed through.

Everything else — `title`, `tagline`, frontmatter `description` — is still plain text, and must
stay that way: frontmatter `description` also feeds `<meta name="description">` and JSON-LD.

### Dev server

`src/server.ts` is a plain `node:http` server over `dist/`, not a bundler dev server — it does a
full `build()` on startup and on every change under `content/`, `src/`, `styles/`, or `public/`
(via `chokidar`, 150ms debounced), then serves the freshly-written static files. No HMR.

### Tests

`test/build.test.ts` runs the entire build pipeline (`build()` from `src/build.ts`) against
`test/fixtures/content/` — a small isolated content tree, not the real `content/` — into a temp
dir, then asserts on the emitted HTML. Other test files unit-test individual pieces
(`schema.test.ts`, `markdown.test.ts`, `html.test.ts`, `exampleCard.test.ts`). `src/linkcheck.ts`
is a separate post-build static check (not a vitest test) that walks every emitted HTML file,
extracts `href`/`src` attributes, and verifies internal links resolve to real files and `#fragment`
links resolve to a real `id` in the target page — part of `npm run check`, not `npm test`.

### CI/deploy

`.github/workflows/ci.yml`: typecheck + tests + build + linkcheck + pa11y-ci, on every PR and push
to `main`. `.github/workflows/deploy.yml`: builds and publishes `dist/` to GitHub Pages on push to
`main`. Both run on GitHub-hosted runners, independent of this repo's devcontainer.
