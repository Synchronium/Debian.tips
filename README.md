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
scripts/            Sandbox, example replay (npm run replay), and content-fixture setup scripts
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
page is replayed against freshly-restored fixtures and diffed against the output the page claims,
and the sample-file blocks are re-read from the sandbox and diffed as well.

```sh
npm run replay              # every page, in one throwaway container
npm run replay -- wget curl # just these

# the same thing one page at a time, if you want to keep the sandbox around
name=$(scripts/sandbox.sh start)
node scripts/verify-examples.mjs "$name" wc scripts/fixtures/wc.sh   # -> "wc (as root): 25/25 ..."
scripts/sandbox.sh stop "$name"
```

Every command page replays at 100% — 535 documented outputs and 64 sample-file blocks. Pages
whose output depends on who ran the command (file ownership, a `~` path, a permission denial) say
so with a `# verify: --user` line in their setup script, which both tools read; the mode is
printed with the score, since the same page scores differently under each. A number
of examples can't run in a batch (they
need a concurrent writer, like `tail -f`); those are listed in a `.skip` file alongside a note on
how they were verified, rather than being quietly dropped.

## CI and deployment

`.github/workflows/ci.yml` runs on every pull request and push to `main`, as two parallel jobs:

- **check** — typecheck, tests, build, linkcheck, then `pa11y-ci` against the built site.
- **replay** — every documented `output:` block re-run for real inside a disposable Debian
  container and diffed against the page. Separate because it needs Docker, and because
  "the generator is broken" and "a page is lying" are different problems.

`.github/workflows/deploy.yml` then publishes to GitHub Pages, but only for a commit CI passed
— it triggers on CI completing successfully and checks out that exact commit, so a red build
can't reach the site. Draft pages (`draft: true` in frontmatter) are excluded from production
builds but visible in local dev.

Dependency updates come from Dependabot (`.github/dependabot.yml`), covering the npm toolchain,
the GitHub Actions used above, and the devcontainer image. Updates are grouped into one pull
request per ecosystem per week, and each goes through the same CI as anything else — which is
the point: an automated bump is only safe to merge if something checks it. Dependabot has no
status badge to display; the badges above are the two workflows, which is where a broken
dependency would actually show up.
