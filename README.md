# debian.tips

[![CI](https://github.com/Synchronium/Debian.tips/actions/workflows/ci.yml/badge.svg)](https://github.com/Synchronium/Debian.tips/actions/workflows/ci.yml)
[![Deploy](https://github.com/Synchronium/Debian.tips/actions/workflows/deploy.yml/badge.svg)](https://github.com/Synchronium/Debian.tips/actions/workflows/deploy.yml)

Practical Linux and Debian tips, tricks, and command references, tested on Debian stable.

Every command example is run inside a throwaway Debian container and the output on the page is
what it printed; they are re-run on every push, and a page whose output no longer matches fails
the build. The site explains this at [debian.tips/about](https://debian.tips/about/), with the
figures counted from the content at build time.

**[debian.tips](https://debian.tips)**

## What this is

A static site generator built from scratch in TypeScript (no framework): Markdown + YAML content,
validated against a Zod schema, rendered through hand-written templates, syntax-highlighted with
Shiki (dual light/dark themes), and indexed for client-side search with Pagefind. Output is plain
HTML/CSS/JS deployed to GitHub Pages: the only JavaScript a visitor downloads is Pagefind's search
and a short script for the theme toggle and the copy buttons.

## Local development

Requires Node 24+ (what CI runs, and what the devcontainer provides).

```sh
npm install
npm run dev      # dev server at http://localhost:4321, rebuilds on file change
npm run build    # one-off production build to dist/
npm run check    # format, typecheck, tests, build, linkcheck, link audit: the full gate
```

## Project structure

```
content/            Markdown + YAML content, one directory per category (see src/content/schema.ts)
src/                Generator: content pipeline, templates, dev server, build/linkcheck scripts
src/templates/      Page templates and shared partials
src/client/         Client JavaScript inlined into every page (theme, copy buttons, search key)
scripts/            Sandbox, example replay (npm run replay), and content-fixture setup scripts
styles/site.css     Full design system (single stylesheet, hashed on build)
public/             Static assets copied as-is into dist/ (favicon, robots.txt, CNAME, search.js)
test/               Vitest unit + build-pipeline tests, with fixture content
```

## Writing content

Content lives entirely in `content/` as Markdown files with YAML frontmatter (command pages also
get an `examples.yaml`). Frontmatter is validated against `src/content/schema.ts` at build time, so
an invalid or incomplete page fails the build with a specific error rather than shipping broken.
See `.claude/skills/write-content-page/SKILL.md` for the full authoring checklist (structure,
length, tone, and verification steps).

### Verifying examples

Every example on this site is run for real, not written from memory or invention. Verification
happens inside a disposable `debian:trixie` container rather than on your own machine:

```sh
name=$(scripts/sandbox.sh start)          # boots a throwaway container, prints its name
scripts/sandbox.sh exec "$name" "<command to verify>"
scripts/sandbox.sh stop "$name"           # discards it; nothing persists
```

"Test the example" sometimes means installing a package, using `sudo`, or standing up a real
service: an example for `ssh` needs an `sshd` to connect to, and one for `crontab` needs the
`cron` daemon running. None of that is worth accumulating on a machine you keep using, and the
container is thrown away afterwards regardless of what the example did to it. Requires Docker;
the project's devcontainer provides it via Docker-in-Docker.

Command pages also declare the sample files their examples run against, shown on the page in a
collapsed "Sample files used on this page" block. Without it, output like `wc -l report.txt` →
`40` can't be checked by a reader who has never seen `report.txt`.

That declaration is only worth anything if it's true, so it's machine-checked: every example on a
page is replayed against freshly-restored fixtures and diffed against the output the page claims,
and the sample-file blocks are re-read from the sandbox and diffed as well.

```sh
npm run replay              # every page, in one throwaway container
npm run replay -- wget curl # just these

# the same thing one page at a time, if you want to keep the sandbox around
name=$(scripts/sandbox.sh start)
npx tsx scripts/replay-command-page.ts "$name" wc scripts/fixtures/wc.sh   # -> "wc (as root): 25/25 ..."
scripts/sandbox.sh stop "$name"
```

Every page with a setup script replays at 100%. The counts (how many outputs are re-run, across
how many pages, and how many are exempt) are on [the about page](https://debian.tips/about/),
counted from the content at build time rather than typed here, where they went stale within a
week the first time. Pages whose output depends on who ran the command (file ownership, a `~`
path, a permission denial) say so with a `# verify: --user` line in their setup script, which
both tools read; the mode is printed with the score, since the same page scores differently under
each. A few examples can't run in a batch at all, because they need a concurrent writer, like
`tail -f`. Those are listed in a `.skip` file alongside a note on how they were verified, rather
than being quietly dropped.

## CI and deployment

`.github/workflows/ci.yml` runs on every pull request and push to `main`, as parallel jobs:

- **check**: typecheck, tests, build, linkcheck, then `pa11y-ci` against the built site.
- **replay**: every documented `output:` block re-run for real inside a disposable Debian
  container and diffed against the page. Separate because it needs Docker, and because
  "the generator is broken" and "a page is lying" are different problems.
- **replay-shuffled**: the same thing in a seeded random order, on `main` only. A page can be
  true on its own and false after another page has run, since they share one container.

`.github/workflows/deploy.yml` then publishes to GitHub Pages, but only for a commit CI passed:
it triggers on CI completing successfully and checks out that exact commit, so a red build
can't reach the site. Draft pages (`draft: true` in frontmatter) are excluded from production
builds but visible in local dev.

Dependency updates come from Dependabot (`.github/dependabot.yml`), covering the npm toolchain,
the GitHub Actions used above, and the devcontainer image. Updates are grouped into one pull
request per ecosystem per week, and each goes through the same CI as anything else: an automated
bump is only safe to merge if something checks it. Dependabot has no status badge of its own, so
the badges above are the two workflows, which is where a broken dependency shows up.
