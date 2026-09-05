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
HTML/CSS/JS deployed to GitHub Pages: the only JavaScript is a short script inlined into each page
for the theme toggle and copy buttons, plus Pagefind's search bundle, fetched when someone opens
the search dialog and not before.

## Local development

Requires Node 24+ (what CI runs, and what the devcontainer provides).

```sh
npm install
npm run dev      # dev server at http://localhost:4321, full rebuild on any file change
npm run build    # one-off production build to dist/
npm run check    # format, typecheck, tests, build, linkcheck, link audit: the full gate
```

## Project structure

```
content/            Markdown + YAML content, one directory per category (see src/content/schema.ts)
src/                Generator: content pipeline, templates, dev server, build/linkcheck scripts
src/templates/      Page templates and shared partials
src/client/         Client TypeScript: inlined into every page, except the fetched search dialog
scripts/            Tools, grouped by when you run them (scripts/README.md is the map)
scripts/replay/     The verification harness: npm run replay, and the sandbox it runs pages in
scripts/fixtures/   A setup script per page, creating the sample files its examples run against
styles/site.css     Full design system (single stylesheet, hashed on build)
public/             Static assets copied as-is into dist/ (favicon, robots.txt, CNAME)
test/               Vitest unit + build-pipeline tests, with fixture content
```

The two are not independent: `scripts/` imports the content contract from `src/content/`, so the
generator and the harness cannot disagree about what a page claims. The dependency runs one way
only, and `docs/adr/0028-src-content-is-the-shared-contract.md` is why.

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
name=$(scripts/replay/sandbox.sh start)          # boots a throwaway container, prints its name
scripts/replay/sandbox.sh exec "$name" "<command to verify>"
scripts/replay/sandbox.sh stop "$name"           # discards it; nothing persists
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
npm run replay              # every page, each in a throwaway container of its own
npm run replay -- wget curl # just these, in the same containers the full run gives them

# the same thing one page at a time, if you want to keep the sandbox around
name=$(scripts/replay/sandbox.sh start)
npx tsx scripts/replay/command-page.ts "$name" wc scripts/fixtures/wc.sh   # prints that page's score
scripts/replay/sandbox.sh stop "$name"
```

The counts (how many outputs are re-run, across how many pages, and how many are exempt, and how
many pages have no setup script yet) are on [the about page](https://debian.tips/about/),
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
- **replay**, several of them: every documented `output:` block re-run for real inside a
  disposable Debian container and diffed against the page, a container per page, one shard per
  runner.
  Separate from `check` because it needs Docker, and because "the generator is broken" and "a
  page is lying" are different problems.

`.github/workflows/drift.yml` replays the whole site once a week on a schedule. Nothing here can
go stale on its own except the one thing that matters most, which is Debian's archive: the sandbox
image builds from a moving tag, so a security update to a package a page documents is enough to
make a true page false. A push to `main` already replays everything, so this only earns its runner
during quiet weeks, which are the weeks nobody would notice. A failure opens an issue rather than
resting in the Actions tab, for the same reason.

`.github/workflows/deploy.yml` then publishes to GitHub Pages, but only for a commit CI passed:
it triggers on CI completing successfully and checks out that exact commit, so a red build
can't reach the site. Draft pages (`draft: true` in frontmatter) are excluded from production
builds but visible in local dev.

Dependency updates come from Dependabot (`.github/dependabot.yml`), covering the npm toolchain,
the GitHub Actions used above, and the devcontainer image. Updates are grouped into one pull
request per ecosystem per week, and each goes through the same CI as anything else: an automated
bump is only safe to merge if something checks it. Dependabot has no status badge of its own, so
the badges above are the two workflows, which is where a broken dependency shows up.
