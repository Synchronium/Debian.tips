# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

debian.tips is a static site generator built from scratch in TypeScript (no framework): content
lives as Markdown + YAML, is validated against a Zod schema, rendered through hand-written HTML
template functions, syntax-highlighted with Shiki, and indexed for client-side search with
Pagefind. Output is plain HTML/CSS/JS deployed to GitHub Pages.

Four skills under `.claude/skills/` cover the recurring jobs, and each carries the traps that
belong to it rather than repeating this file: `write-content-page` (authoring, verification,
tiering), `cross-link-pages` (the link graph after a new page), `ship` (gates, CI, deployment)
and `review-dependency-prs` (what a Dependabot bump can actually break here).

## Commands

```sh
npm install
npm run dev      # dev server at http://localhost:4321, full rebuild on any file change
npm run build    # one-off production build to dist/
npm test         # vitest run (unit + fixture-based build tests)
npm run check    # tsc --noEmit && vitest run && build && pagefind && linkcheck && link-audit — the full gate
npm run replay   # replay every command page's examples in a sandbox (needs Docker, ~30s warm)
npm run audit:links -- --verbose   # the link graph on its own, advisory findings included
```

Run `npm run check` before treating any change as done — it's also what CI runs (`.github/workflows/ci.yml`), followed by `pa11y-ci` as a separate accessibility gate.

Single test file: `npx vitest run test/schema.test.ts`
Single test by name: `npx vitest run -t "accepts a valid command page"`

Accessibility check locally (matches CI): build, serve `dist/`, then run pa11y-ci against it —
`npm run build && npx serve -l 4321 dist & npx wait-on http://localhost:4321 && npx pa11y-ci`.

There is no lint script/config in this repo — `tsc --noEmit` (strict mode, plus
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`noImplicitOverride`) is the only static
check beyond tests. It covers `src/`, `test/` and `scripts/`: the replay harness is TypeScript
too, run through `tsx`, and imports the content types from `src/content/schema.ts` rather than
keeping its own idea of what an `examples.yaml` contains.

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
validates shape, not truth. `scripts/verify-examples.ts` replays every example on a page inside
the sandbox and diffs the real result against what the page claims:

```sh
npm run replay              # every page: starts one sandbox, runs them all, stops it
npm run replay -- wget curl # just these

# or drive one page directly, which is what the above does per page:
name=$(scripts/sandbox.sh start)
npx tsx scripts/verify-examples.ts "$name" wc scripts/fixtures/wc.sh   # -> "wc (as root): 25/25 ..."
```

`npm run replay` runs in CI as its own job (`.github/workflows/ci.yml`), in parallel with the
`check` job, because "the generator is broken" and "a page is lying" want different people looking
at them. It stays out of `npm run check` so that command needs nothing but Node: the replay needs
Docker, and a check you can't run without a daemon isn't one to fold into the everyday gate. All
seventeen pages replay in under 30 seconds; a cold CI run is dominated by building the sandbox
image, which the workflow does as its own step so the log says which half any slowness is in.

That invocation is correct for every page. Some pages have to replay as the unprivileged
`user` — anything printing file ownership (`tar -tvf`, `ls -l`) or documenting a permission
denial, since root simply doesn't get denied — and each of those says so itself, with a
`# verify: --user` line in its setup script that both `verify-examples.ts` and
`adopt-real-output.ts` read.

A second directive, `# verify: --systemd`, asks for a sandbox booted with systemd as PID 1
(`scripts/sandbox.sh start --systemd`). The `systemctl` and `journalctl` pages need it: the
default sandbox runs `sleep` as PID 1, where every such example prints "System has not been
booted with systemd as init system (PID 1). Can't operate." It is the same image — systemd is
already installed — but a different runtime, costing `--privileged` and the host's cgroup tree,
which is why it is opt-in per page rather than the default. `npm run replay` starts only the
flavours the selected pages ask for, and `verify-examples.ts` refuses to replay a `--systemd`
page in a sandbox whose PID 1 isn't systemd rather than producing a page of identical errors. Replayed as root, `chmod` scores 9/42 and `tar` 32/42 on pages that
are entirely correct, which reads exactly like a page that has drifted; the mode is part of the
score, so it's printed alongside it.

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

Every command page replays at 100% — 535 outputs across all seventeen. If you touch a
covered page, re-run its replay; if you add examples to an uncovered one, consider adding them.

An example whose output is real but can't reproduce byte for byte — it carries a PID, an uptime,
a memory figure — declares `volatile:` with a note saying what differs. The note renders above the
output block ("Your output will differ: …") so a reader can tell an expected difference from a
broken command, and the replay compares that example by *shape* instead: quantities and their
units, weekday and month names, long hex identifiers, digits and column padding are masked on both
sides, so the numbers may move while a renamed field, a vanished line or a changed state still
fails. `volatile:` is for output that varies, not for output a reader could never produce — a
harness artifact has to be removed, not declared. The score names the two kinds separately
(`53/53 documented outputs reproduce (52 exactly, 1 by shape)`), because they are different
claims.

Examples a batch can't replay at all (needing a concurrent writer or a network peer) are listed by
title in `scripts/fixtures/<command>.skip` with a note on how they were verified instead — they're
excluded explicitly rather than quietly failing. Entries are matched exactly and must name a real
example that documents an `output:` block; one that matches nothing is an error, because it reads
as an exemption while exempting nothing.

`scripts/lib/normalise.ts` decides what a page is allowed to claim, and both tools share it:
adopt writes its `stripArtifacts` output onto the page, verify compares its `normalise` output
against a fresh run. That shared path is why a bug in it is invisible — it corrupts the page and
then certifies the corruption — so it's covered by `test/normalise.test.ts`, and every mask is
anchored to the line shape that produces it rather than applied to the whole output. A documented
output may never contain a mask token (`<TIMESTAMP>`, `<RATE>`, `<VOLATILE>`, `<ELAPSED>`): the
masks are idempotent, so a page carrying one would match any real output forever. The replay
rejects that outright.

The failure modes this has caught are written up in `.claude/skills/write-content-page/SKILL.md`
§4a. The most easily-missed: `wc`/`uniq -c` right-align their columns, and a plain YAML `|` block
silently strips that padding — such outputs need `output: |2`.

### Prose pages are replayed too, by a different route

Concepts, scripting lessons, recipes and Debian articles state the same kind of claim as a
command page, but as Markdown rather than YAML: a ```` ```bash ```` fence followed by the output
it produced. `scripts/verify-prose.ts` replays those, `scripts/lib/proseBlocks.ts` pairs them up,
and `npm run replay` runs both kinds. A prose page opts in by having `scripts/fixtures/<slug>.sh`;
without one it is listed as not replayed rather than passed over silently.

The pairing rule is strict on purpose: an output fence belongs to a command only when it opens on
the line **immediately** after that command's fence closes. Pairing on document order instead
matched a block that prose had separated from its command, which on one page attributed a
simulated install's output to a real one. `test/proseBlocks.test.ts` pins that.

Per-block directives are HTML comments on the line directly above the command fence, since
Markdown has nowhere else to put them and the pipeline drops HTML before a reader sees it:

```
<!-- verify: shape the version moves whenever a security update lands -->
<!-- verify: skip needs a second terminal writing to the file -->
```

A skip must give a reason or the tool refuses to run — an unexplained exemption reads as verified
when it is the opposite.

**Never document an architecture.** `arm64` on this devcontainer, `amd64` on a CI runner, and
emulation is unavailable locally, so any block containing one fails in exactly one of the two
places. This is why no page prints `dpkg -l` or a bare `apt-cache policy` and why the apt page
uses `dpkg -s` and `apt-cache policy <pkg> | head -3` instead. It is the same rule the command
pages have always followed by accident; prose pages have to follow it deliberately.

Bare fences that pair with nothing (a `.sources` stanza, a config snippet) are counted and
reported as "not checkable" rather than failed. The count is what tells an author which of their
blocks is a claim nobody checks.

The first page through this, `apt-essentials`, had **four broken output blocks out of four**: two
silently abridged (`dpkg -l` prints a five-line header; one fence ran three commands and showed
only the third's output), and two drifted (`13.5` → `13.6`, `deb13u3` → `deb13u4`). It had been
wrong for months and nothing could have told us.

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

### The link audit

`scripts/link-audit.ts` asks the question linkcheck doesn't: not whether the links that exist
resolve, but whether the ones that should exist do. It builds a graph from `related:` frontmatter
plus every root-relative link in prose, example descriptions, section intros and fixture notes,
then reports pages nothing links to (**orphaned**), pages linking to fewer than two others
(**thin**), and pages reachable from exactly one (**weakly linked**). The first two fail the
build; the third prints as a count unless you pass `--verbose`, since the gate runs this on every
push and an advisory list nobody reads is worse than no list.

A new page is an orphan by construction — nothing knew it was coming — and until this existed
nothing in the repo noticed. Drafts are exempt from both defect checks, because the loader already
rejects a published page linking to a draft, so a draft could never be anything but an orphan.

The graph itself lives in `scripts/lib/linkGraph.ts` and is covered by `test/linkGraph.test.ts`,
on the same reasoning as `normalise.ts`: a missing edge invents an orphan, which is noisy but
visible, while an invented edge hides a real one behind a clean report. Heading anchors
(`href="#flags"`, which rehype-autolink-headings puts on every `##`) and self-links are the two
that would do it, and both are pinned by a test.

`.claude/skills/cross-link-pages/SKILL.md` is the editorial half — what to do with the report,
and why the fix is almost always an inline link on the sentence that raises the question rather
than another `related:` entry.

### CI/deploy

`.github/workflows/ci.yml`: typecheck + tests + build + linkcheck + link-audit + pa11y-ci, on every PR and push
to `main`. `.github/workflows/deploy.yml`: builds and publishes `dist/` to GitHub Pages on push to
`main`. Both run on GitHub-hosted runners, independent of this repo's devcontainer.

### The local HTTP server

The `curl` and `wget` pages point at `http://127.0.0.1:8080`, served by
`scripts/fixtures/http-mock.py` — thirteen-odd endpoints that echo a request, return a chosen
status, redirect, delay, set a cookie, demand basic auth, or serve a small linked site with
`Range` and `If-Modified-Since` support. `verify-examples.ts` installs any `.py` under
`scripts/fixtures/` into `/opt/mock/` in the sandbox, and each page's setup script starts it.

It binds `127.0.0.1` by default, because readers are told to run it on their own machines and it
echoes request headers — `Authorization` included — to anyone who asks. Pass a bind address as a
second argument to widen it deliberately.

The pages name `127.0.0.1` rather than `localhost` on purpose: what `localhost` resolves to is a
property of the reader's machine. wget prints the address it resolved and connected to, so a page
captured where `localhost` means `::1` shows two lines nobody on an IPv4-only host can reproduce —
and a container with IPv6 switched off, which is what a CI runner often is, can't even bind it.
Naming the address makes the same output true everywhere, and drops a resolution line that was
never about wget.

Public request-echo services were the obvious alternative and are the reason the curl page's
outputs were fabricated before this: they answer with a trace id, a live date and the caller's
public IP, so nothing they return can be printed as exact output. Both pages say in their prose
how to start the server, because an example that displays a URL the reader can't reach is
displaying output the shown command didn't produce.

Anything added to the server must stay deterministic: sort JSON keys, keep the fixed indent, and
never return a value from the clock, the client address, or a random source. That extends to the
framework's own headers — `Date` and `Server` are both pinned — which is what lets a page print a
`curl -i` response verbatim instead of masking half of it. Conditional requests compare the date
they were given rather than assuming it, so `-N`/`-z` can demonstrate both branches, and a range
past the end of a file gets a 416 rather than the whole file over again.
