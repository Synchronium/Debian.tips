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
npm run check    # format, tsc --noEmit, vitest, build, pagefind, linkcheck, link-audit: the full gate
npm run replay   # replay every page's examples, one container each (needs Docker, and minutes)
npm run replay -- --changed        # only the pages your diff touches, which is what CI runs on a PR
npm run replay -- ls du            # named pages; identical to how the full run replays them
npm run replay -- --shard=2/4      # the second of four parts; the split CI runs is in ci.yml
npm run shards   # whether the shard count in ci.yml still suits the recorded times, and the curve
npm run audit:links -- --verbose   # the link graph on its own, advisory findings included
npm run voice    # prose against .claude/reference/voice.md; a hook runs it per file as you write
npm run browser  # search and narrow-screen layout, in a real browser against a served build
npm run og       # redraws public/og-default.png, the share card, from styles/site.css
```

`--shard` exists for CI, which gives each shard a machine of its own. How many it runs is in the
matrix in `.github/workflows/ci.yml`, and `npm run shards` is what says whether that number still
suits the recorded times: it prints the whole curve, so nothing here or in the workflow has to
carry a measurement that the next page moves. One shard at a time is a fine way to reproduce what
a red shard ran, but starting several here at once is the contention that makes true pages report
as lying (`.claude/skills/ship/SKILL.md` §1): locally, the plain `npm run replay` is both faster
and honest.

Run `npm run check` before treating any change as done. It's also what CI runs
(`.github/workflows/ci.yml`), followed by `pa11y-ci` as a separate accessibility gate whose URL
list is generated from the built sitemap by `scripts/pa11y-urls.ts`. `check` sets
`NODE_ENV=production` itself, so the local gate and the CI one see the same site: drafts are
excluded from both.

Single test file: `npx vitest run test/schema.test.ts`
Single test by name: `npx vitest run -t "accepts a valid command page"`

The two gates that need a running site, against a served build:

```sh
npm run build && npx serve -l 4321 dist &
npx wait-on http://localhost:4321
npm run a11y      # pa11y-ci over one page per template, WCAG2AA
npm run browser   # search really returns results; no page scrolls sideways at 320px
```

Both are the same commands CI runs, as two steps against one served build.

`npm run browser` covers what a build cannot establish about itself. Search runs entirely in the
browser against Pagefind's WASM bundle, so nothing in `npm run check` loads it and a broken search
still builds, still passes every test and still deploys; and a stylesheet change can make a page
scroll sideways without changing a byte of markup. Both are asserted as properties, because
ADR-0022 rules out snapshots and pixel baselines and says why.

**Never `npx pa11y-ci` on its own**: the URL list is generated from the built sitemap into
`.pa11yci.generated.json`, so bare `pa11y-ci` reads `.pa11yci.json`, finds no `urls`, checks
nothing and exits 0. `npm run a11y` generates the list first and refuses to write one that is
missing a category listing.

Static checks are `npm run format:check` (Prettier) and `tsc --noEmit`, both part of
`npm run check`. TypeScript runs strict plus `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`,
`noImplicitReturns` and `noFallthroughCasesInSwitch`, which is doing the work a lint config
usually would.

**There is no ESLint**, and not for lack of trying: no released `typescript-eslint` supports
TypeScript 7 (its peer range caps at `<6.1.0`, canary included), and forcing it gives a parser
that misreads the code and a check that lies. Revisit when that lands.

Prettier is scoped to `src/`, `scripts/`, `test/` and `styles/`, and **never touches `content/`**
(`.prettierignore` explains why at length). The short version is that `output: |2` blocks and
prose fence adjacency decide what the site claims, so reformatting them would change it while
the replay re-certified the result. `embeddedLanguageFormatting` is `off` for a related
reason: Prettier recognises the `html` tagged template and will reformat the site's markup
inside it, which changed every emitted page the first time this was set up.

`tsc` covers `src/`, `test/` and `scripts/` together: the replay harness is TypeScript too, run
through `tsx`, and it imports the content types from `src/content/schema.ts` rather than keeping
its own idea of what an `examples.yaml` contains.

Some files are checked by a config of their own instead, and all of it is about keeping DOM globals
out of Node code, where `document` is always a mistake (ADR-0013). `src/client/` is browser code
and gets `tsconfig.client.json`. `scripts/browser-check.ts` and `scripts/og-image.ts` are Node code
that *contains* browser code, since the callbacks they hand to `page.evaluate()` run inside the
page, and both get `tsconfig.browser-check.json`. A file joining that list leaves `tsconfig.json`
in the same commit, or it is checked twice and the second check is the one it was moved to escape. **Do not widen `lib` in `tsconfig.json` to satisfy either.** That
makes `document` typecheck across the whole build and harness, and the failure it lets through is
one that only appears at runtime. All three configs run in `npm run check`.

## The one thing that makes this site different

Every example on every page was run for real, and is run again on every push. `npm run check`
validates *shape* (schema, types, links) and would happily pass a page whose output no command
ever produced. Only `npm run replay` checks that the claims are true.

Three rules follow from that, and all three have been broken here at least once:

- **Never write output from memory.** Run the command in the sandbox and paste what it printed.
  Verifying sometimes means installing a package or standing up a service, which is what the
  disposable container is for.
- **Never document an architecture.** `arm64` here, `amd64` on a CI runner, no emulation
  locally, so any block naming one fails in exactly one of the two places. The constraint is on
  the *package*, not the command: an `Architecture: all` package prints `all` everywhere, which
  is what lets the `apt` and `dpkg` pages show `apt list` and `dpkg -l` at all.
  `test/architecture.test.ts` enforces this, and rejects an exemption whose stated reason is the
  architecture, since that is the defect rather than a record of how it was checked instead.
- **Your page starts from the image, and from nothing else.** Each page is replayed in a container
  of its own (ADR-0020), so a port, an apt source, an `apt.conf`, a GPG key, a new account or a
  package state another page leaves behind cannot reach yours. `npm run replay -- <page>` puts the
  page in the same container the full run does, so it is authoritative rather than indicative.
  What a setup script still owes is **the state its own earlier examples destroy**: it runs before
  every example, but the restore only resets the page's working directory, so an example that
  installs a package or writes to `/etc` has changed what every later example on that page sees.

## Writing code here

Every page on this site links to the files that produced it (ADR-0017), so the code is part of
what the site publishes. Someone arriving from a page has one question, "is this claim really
checked?", and they are reading a file they have never seen before, in a repository they do not
know. **Optimise for that reader.** Three rules, each of which this codebase has broken often
enough to be worth writing down.

**Never compare against a bare literal.** A set of allowed values gets a `const` object with the
type derived from it, and every comparison goes through that:

```ts
export const SANDBOX_FLAVOUR = { default: "default", systemd: "systemd" } as const;
export type SandboxFlavour = (typeof SANDBOX_FLAVOUR)[keyof typeof SANDBOX_FLAVOUR];
//  flavourOf(name) === SANDBOX_FLAVOUR.systemd     not  flavourOf(name) === "systemd"
```

`COMPARISON`, `EDGE_KIND`, `SANDBOX_FLAVOUR`, `SANDBOX_TOOL` and `SETUP_DIRECTIVE` are the
existing ones; follow them. A union type is not enough on its own: `type X = "a" | "b"`
still leaves the literal written out at every use, and a value that is validated in one place and
re-spelled in another *fails open*, staying green while quietly doing nothing. The same goes for
paths, filenames and routes: `src/paths.ts` owns where things are and `src/config.ts` owns the
site's routes, so `"404.html"` or `/tags/` written into a third file is a bug waiting for a
rename. A string a *reader* sees is the same rule, so the expand-all labels live in one template and
reach the client script as a `data-` attribute rather than being typed twice.

**Comments explain the rule, never the history.** Say what the code guarantees and what breaks
without it. Do not say what the code used to be, when it changed, which page it broke, or what the
review found. Git has the first, `docs/adr/` has the rest, and prose that has to be read past to
reach the point is worse than no prose. A comment is also a claim that goes stale: no counts of
examples or pages, no measurements that will move, no naming another page that might be renamed.

A comment is prose the site publishes, so it is held to `.claude/reference/voice.md` like any
sentence on a page, and its §8 is the half that only applies here. That is not a style preference:
a reader who followed a link from a page to check whether a claim is really checked has landed on
this comment, and prose that sounds generated undermines the thing they came to verify. The same
goes for `README.md`, `docs/adr/` and the documents in `.claude/`.

```sh
# Good: the rule, and what breaks without it.
# cowsay-off adds three cowfiles, so `cowsay -l` lists 50 rather than 47 when it is installed.
# A page whose output depends on a package being absent has to assert that.

# Bad: the incident.
# Alphabetically the apt page had already purged it before this page ran, so the batch was
# green until a shuffled run put remove-vs-purge first, which is how this was found...
```

**Name things for what they are now.** A file called `replay.ts` that replays nothing, a
`verify-*.ts` that exports a `replay*` function, a `stats.ts` in a directory called `content`:
each costs a reader a wrong guess before they reach the code. If a rename is right, do it: the
imports are typechecked and `test/documentedPaths.test.ts` catches every stale mention in the
comments and the docs, so the change is mechanically verifiable rather than a leap.

## Where the content lives

`src/content/schema.ts` is the single source of truth for what a page needs, and its comment on
`CATEGORIES` gives the test for which category a page belongs in, including how many categories
there are, which is why no other document lists them. Every category except `commands` is flat
`content/<category>/<slug>.md`; `commands` is a directory per command,
`content/commands/<slug>/index.md` paired with `examples.yaml`.

Slugs are unique per category rather than site-wide, so `related:` accepts either a bare slug or
`category/slug`, and says so when a bare one is ambiguous. Two pages sharing a slug may not have a
replay setup script at all, not even one of them: those are named `scripts/fixtures/<slug>.sh`, so
a shared slug with a script attached belongs to a page nothing can identify, and everything stored
per page would credit it to whichever of the two was found first.
`test/replayTimings.test.ts` names any such pair, and the replay refuses to start.

## Where to look

This file is deliberately short. The detail lives next to the job that needs it:

| Doing what | Read |
| --- | --- |
| Writing or fixing a content page | `.claude/skills/write-content-page/SKILL.md` |
| Writing any prose: a page, a comment, an ADR, a README | `.claude/reference/voice.md` |
| Cross-linking after a new page | `.claude/skills/cross-link-pages/SKILL.md` |
| Committing, pushing, a CI failure | `.claude/skills/ship/SKILL.md` |
| Reviewing a Dependabot PR | `.claude/skills/review-dependency-prs/SKILL.md` |
| Changing the replay harness, or a replay failing oddly | `.claude/reference/verification.md` |
| Changing `src/`: pipeline, templates, markdown, dev server, link audit | `.claude/reference/architecture.md` |
| Why something is the way it is, before changing it | `docs/adr/` |

The two reference documents are where the long-form explanations went; nothing was dropped in
moving them, and they carry the failure modes that produced each rule.

## When a change needs a new ADR

`docs/adr/` is the standing record of why things are the way they are, and it only works if
changes keep it current. Two rules.

**A change that contradicts an existing record deals with that record, in the same commit.** A
stale ADR is worse than a missing one: it is read as current, and it is read precisely by someone
already mid-decision. Which treatment depends on the size of the change. A reversed or replaced
decision gets a new record with the old one marked `Superseded by ADR-00NN`, keeping its reasoning
where the next person can find it; a record that is merely wrong or unclear is edited in place.
`docs/adr/README.md` has the distinction.

**A change that makes a decision nothing covers should come with a proposed ADR, proposed rather
than merged.** Say what you'd write and let the user decide before adding it, the same way a new tag
gets asked about rather than added. The test is whether someone would otherwise re-litigate the
choice, or undo it by accident without knowing it was a choice: a new gate, a new category, a
constraint on what content may claim, a dependency the output shape now depends on. Ordinary work
inside an existing decision is not an ADR, and neither is a preference nobody could break by
accident.

Keep the shape of the existing records (Context, Decision, Consequences, Revisit when) and name
what **enforces** it. If nothing does, write that: `docs/adr/README.md` explains why the empty
field is worth having rather than hiding.
