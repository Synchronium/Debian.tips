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

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. Draft pages (`draft: true` in frontmatter) are excluded from
production builds but visible in local dev.
