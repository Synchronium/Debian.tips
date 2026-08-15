# debian.tips

[![CI](https://github.com/Synchronium/Debian.tips/actions/workflows/ci.yml/badge.svg)](https://github.com/Synchronium/Debian.tips/actions/workflows/ci.yml)
[![Deploy](https://github.com/Synchronium/Debian.tips/actions/workflows/deploy.yml/badge.svg)](https://github.com/Synchronium/Debian.tips/actions/workflows/deploy.yml)

Practical Linux and Debian tips, tricks, and command references — tested on Debian stable.

**[debian.tips](https://debian.tips)**

## What this is

A static site generator built from scratch in TypeScript (no framework): Markdown + YAML content,
validated against a Zod schema, rendered through hand-written templates, syntax-highlighted with
Shiki (dual light/dark themes), and indexed for client-side search with Pagefind. Output is plain
HTML/CSS/JS deployed to GitHub Pages — no client-side framework, no build-time bloat.

## Local development

Requires Node 22+.

```sh
npm install
npm run dev      # dev server at http://localhost:4321, rebuilds on file change
npm run build    # one-off production build to dist/
npm run check    # typecheck + tests + build + linkcheck — run before committing
```

## Project structure

```
content/            Markdown + YAML content (commands, concepts, scripting, recipes, debian)
src/                Generator: content pipeline, templates, dev server, build/linkcheck scripts
src/templates/      Page templates and shared partials
scripts/sandbox.sh  Disposable Docker sandbox for testing content examples (see below)
styles/site.css     Full design system (single stylesheet, hashed on build)
public/             Static assets copied as-is into dist/ (favicon, robots.txt, CNAME, search.js)
test/               Vitest unit + build-pipeline tests, with fixture content
```

## Writing content

Content lives entirely in `content/` as Markdown files with YAML frontmatter (command pages also
get an `examples.yaml`). Frontmatter is validated against `src/content/schema.ts` at build time —
an invalid or incomplete page fails the build with a specific error rather than shipping broken.
See `.claude/skills/write-content-page/SKILL.md` for the full authoring checklist (structure,
length, tone, and verification steps).

### Verifying examples

Every example on this site is run for real, not written from memory or invention. Verification
happens inside a disposable `debian:trixie` container rather than on your own machine:

```sh
name=$(scripts/sandbox.sh start)          # boots a throwaway container, prints its name
scripts/sandbox.sh exec "$name" "<command to verify>"
scripts/sandbox.sh stop "$name"           # discards it — nothing persists
```

This matters because "test the example" sometimes means installing a package, using `sudo`, or
standing up a real service (an example for `ssh` needs an actual `sshd` to connect to; one for
`crontab` needs the `cron` daemon actually running) — none of which you want accumulating on a
machine you keep using. The container is thrown away afterwards regardless of what the example
did to it. Requires Docker; the project's devcontainer has it out of the box via Docker-in-Docker.

Command pages also declare the sample files their examples run against, shown on the page in a
collapsed "Sample files used on this page" block — otherwise output like `wc -l report.txt` → `40`
can't be checked by a reader who's never seen `report.txt`.

That declaration is only worth anything if it's true, so it's machine-checked: every example on a
page is replayed against freshly-restored fixtures and diffed against the output the page claims.

```sh
name=$(scripts/sandbox.sh start)
node scripts/verify-examples.mjs "$name" wc scripts/fixtures/wc.sh   # -> "wc: 25/25 ..."
scripts/sandbox.sh stop "$name"
```

Ten pages currently replay at 100% — 330 documented outputs across `wc`, `sort`, `uniq`, `cut`,
`tr`, `head`, `diff`, `grep`, `sed` and `awk`. A handful of examples can't run in a batch (they
need a concurrent writer, like `tail -f`); those are listed in a `.skip` file alongside a note on
how they were verified, rather than being quietly dropped.

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. Draft pages (`draft: true` in frontmatter) are excluded from
production builds but visible in local dev.
