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
npm run check    # format, tsc --noEmit, vitest, build, pagefind, linkcheck, link-audit — the full gate
npm run replay   # replay every page's examples in a sandbox (needs Docker, ~2.5 min warm)
npm run replay -- --changed        # only the pages your diff touches — what CI runs on a PR
npm run audit:links -- --verbose   # the link graph on its own, advisory findings included
```

Run `npm run check` before treating any change as done — it's also what CI runs
(`.github/workflows/ci.yml`), followed by `pa11y-ci` as a separate accessibility gate whose URL
list is generated from the built sitemap by `scripts/pa11y-urls.ts`. `check` sets
`NODE_ENV=production` itself, so the local gate and the CI one see the same site: drafts are
excluded from both.

Single test file: `npx vitest run test/schema.test.ts`
Single test by name: `npx vitest run -t "accepts a valid command page"`

Accessibility check locally (matches CI): build, serve `dist/`, then run pa11y-ci against it —
`npm run build && npx serve -l 4321 dist & npx wait-on http://localhost:4321 && npx pa11y-ci`.

Static checks are `npm run format:check` (Prettier) and `tsc --noEmit`, both part of
`npm run check`. TypeScript runs strict plus `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`,
`noImplicitReturns` and `noFallthroughCasesInSwitch`, which is doing the work a lint config
usually would.

**There is no ESLint**, and not for lack of trying: no released `typescript-eslint` supports
TypeScript 7 (its peer range caps at `<6.1.0`, canary included), and forcing it gives a parser
that misreads the code and a check that lies. Revisit when that lands.

Prettier is scoped to `src/`, `scripts/`, `test/` and `styles/`, and **never touches `content/`**
— `.prettierignore` explains why at length, but the short version is that `output: |2` blocks and
prose fence adjacency are load-bearing, and reformatting them would change what the site claims
while the replay re-certified the result. `embeddedLanguageFormatting` is `off` for a related
reason: Prettier recognises the `html` tagged template and will reformat the site's markup
inside it, which changed every emitted page the first time this was set up. It covers `src/`, `test/` and `scripts/`: the replay harness is TypeScript
too, run through `tsx`, and imports the content types from `src/content/schema.ts` rather than
keeping its own idea of what an `examples.yaml` contains.

## The one thing that makes this site different

Every example on every page was run for real, and is run again on every push. `npm run check`
validates *shape* — schema, types, links — and would happily pass a page whose output no command
ever produced. `npm run replay` is what checks the claims are true.

Three rules follow from that, and all three have been broken here at least once:

- **Never write output from memory.** Run the command in the sandbox and paste what it printed.
  Verifying sometimes means installing a package or standing up a service, which is what the
  disposable container is for.
- **Never document an architecture.** `arm64` here, `amd64` on a CI runner, no emulation
  locally, so any block naming one fails in exactly one of the two places. The constraint is on
  the *package*, not the command: an `Architecture: all` package prints `all` everywhere, which
  is what lets the `apt` and `dpkg` pages show `apt list` and `dpkg -l` at all.
  `test/architecture.test.ts` enforces this, and rejects an exemption whose stated reason is the
  architecture — that is the defect, not a record of how it was checked instead.
- **Assume another page can see what your fixture changes.** `npm run replay` runs every page in
  one sandbox, so a port, an apt source, an `apt.conf`, a GPG key, a new account or a package
  state left behind changes what a later page sees. Six failures so far have been exactly this,
  every one of them invisible to a single-page run and obvious in the batch. Each page's setup
  script normalises what it needs rather than trusting what it finds.

## Where the content lives

`src/content/schema.ts` is the single source of truth for what a page needs, and its comment on
`CATEGORIES` gives the test for which category a page belongs in — including how many categories
there are, which is why no other document lists them. Every category except `commands` is flat
`content/<category>/<slug>.md`; `commands` is a directory per command,
`content/commands/<slug>/index.md` paired with `examples.yaml`.

Slugs are unique per category rather than site-wide, so `related:` accepts either a bare slug or
`category/slug`, and says so when a bare one is ambiguous. Two pages sharing a slug may not both
have a replay setup script, since those are named `scripts/fixtures/<slug>.sh`.

## Where to look

This file is deliberately short. The detail lives next to the job that needs it:

| Doing what | Read |
| --- | --- |
| Writing or fixing a content page | `.claude/skills/write-content-page/SKILL.md` |
| Cross-linking after a new page | `.claude/skills/cross-link-pages/SKILL.md` |
| Committing, pushing, a CI failure | `.claude/skills/ship/SKILL.md` |
| Reviewing a Dependabot PR | `.claude/skills/review-dependency-prs/SKILL.md` |
| Changing the replay harness, or a replay failing oddly | `.claude/reference/verification.md` |
| Changing `src/` — pipeline, templates, markdown, dev server, link audit | `.claude/reference/architecture.md` |
| Why something is the way it is, before changing it | `docs/adr/` |

The two reference documents are where the long-form explanations went; nothing was dropped in
moving them, and they carry the failure modes that produced each rule.

## When a change needs a new ADR

`docs/adr/` records decisions, not history — there are no superseded records, so a decision that
changes is *edited*, and git history is the audit trail. Two things follow.

**A change that contradicts an existing record updates that record, in the same commit.** A stale
ADR is worse than a missing one: it is read as current, and it is read precisely by someone about
to make a decision.

**A change that makes a decision nothing covers should come with a proposed ADR — proposed, not
merged.** Say what you'd write and let the user decide before adding it, the same way a new tag
gets asked about rather than added. The test is whether someone would otherwise re-litigate the
choice, or undo it by accident without knowing it was a choice: a new gate, a new category, a
constraint on what content may claim, a dependency the output shape now depends on. Ordinary work
inside an existing decision is not an ADR, and neither is a preference nobody could break by
accident.

Keep the shape of the existing records — Context, Decision, Consequences, Revisit when — and name
what **enforces** it. If the honest answer is "nothing", write that: `docs/adr/README.md` explains
why the empty field is worth having rather than hiding.
