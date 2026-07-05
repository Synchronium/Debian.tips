---
name: write-content-page
description: Author or extend one debian.tips content page (command reference, concept, scripting lesson, recipe, or Debian article) to the site's schema, tiering, and style-guide contract. Use when asked to write, draft, or expand a specific page — e.g. "write the sed page", "add examples for tar", "draft the exit-codes-and-error-handling concept", "write recipe: bulk-rename-files". Not for open-ended "what should we write next" planning.
---

# Write a debian.tips content page

One page per invocation. This checklist is self-contained — everything it references
(`src/content/schema.ts`, `content/tags.yaml`, existing content under `content/`) is committed to
the repo, so it works the same for anyone who clones it, not just this working copy. If this
project happens to keep its own internal planning notes locally, they're worth a skim for extra
prose detail, but nothing below depends on them existing.

## 1. Identify the page

From the request, work out:
- **category** (`commands|concepts|scripting|recipes|debian`) → target directory
- **slug** → directory/file name (command pages: `content/commands/<slug>/`; others:
  `content/<category>/<slug>.md`)
- **tier** (commands only: `flagship|standard|light`) — drives length and example count. Judge it
  by comparing to existing pages in `content/commands/`: a big, commonly-reached-for command with
  real depth (grep, find, sed, curl) is flagship; an everyday command with modest scope (tar) is
  standard; a small single-purpose command is light.
- for combined pages covering more than one command (e.g. "job control" covering `jobs`/`fg`/`bg`),
  the primary command is the slug/title; the others get their own `##` sections within the same page

If the category, slug, or tier isn't obvious from the request or from comparable existing
content, stop and ask rather than guessing.

## 2. Check the schema, not just this checklist

Read `src/content/schema.ts` — it's authoritative if anything below has drifted out of sync with
it. Frontmatter needs `title`, `description` (50–160 chars), `tags` (1–6), `updated` (ISO date,
use today), `category`; command pages also need `tagline` (≤60 chars) and `tier`; scripting pages
need a unique `order`. `related` is optional but every slug in it must exist (or be created in
this same batch).

Check `content/tags.yaml` for the allowed tag set. Tags are curated on purpose — if the page
genuinely needs a concept not in the registry, stop and ask before adding one; don't just add it
because a page reads better with it.

## 3. Match structure and length to page type

- **Commands**: `index.md` prose intro (flagship 600–1200 words / standard 150–400 / light
  50–150) + `examples.yaml` (flagship/standard 50–100 examples, light 25–50), sections ordered
  basic → advanced, `command:` field matching the directory name.
- **Concepts**: 800–2000 words — hook → mental model → worked examples → common misconceptions →
  "go deeper" links.
- **Scripting**: one concept, runnable script(s), a pitfalls callout, exercises with `<details>`
  answers; `order` drives prev/next.
- **Recipes**: 300–700 words, rigid **Problem → Solution → How it works → Variations**; one task
  per recipe.
- **Debian**: same shape as concepts, Debian-specific.

## 4. Test every example for real — don't fabricate output

This devcontainer runs Debian trixie (`mcr.microsoft.com/devcontainers/typescript-node:...-trixie`),
so treat it as "current Debian stable":

- Actually run each command with the Bash tool before writing its `output:` block. Copy real
  output, then sanitize hostnames/users to `deb1`/`user`.
- If a command can't be safely or meaningfully run here (needs root, touches real hardware, is
  destructive, needs a package that isn't installed), say so explicitly in your reply instead of
  inventing plausible-looking output — flag it for the user to verify on a real box.
- Destructive examples (`rm`, `dd`, `mkfs`, `chmod -R`, `curl | sh`, etc.) get `danger: true` and
  the description must state the failure mode. Prefer teaching the safe variant first.

## 5. Style guide (apply to every sentence)

Direct, second person, no fluff, no "In today's fast-paced world." **British English in all
prose** (`colour`, `flavour`, `behaviour`, `sanitised`, `organise`, `-ise` not `-ize`) — but never
touch a real flag, command, package name, or captured output for spelling (`--color` stays
`--color`; a real GNU grep flag). Realistic placeholders (`access.log`, `~/projects`) — never
`foo`/`file1`. Show the short flag in code; mention the long form in prose when it aids memory.
Titles are outcomes ("Find files modified in the last 24 hours"), not syntax ("Using -mtime").
Every page links ≥ 2 related pages using root-relative paths (`/concepts/pipes-and-redirection/`).
Avoid common AI tropes — em dashes, "it's not X, it's Y", "here's why that matters", and similar.

## 6. Verify before calling it done

Run `npm run check` (typecheck, tests, build, linkcheck). Fix any schema violation, missing tag,
dead `related` link, or broken cross-link it surfaces — don't hand back a page that fails this.

## Notes for future parallel/batch use

This checklist is written so it can be handed to a subagent per page with no extra context
beyond "write page X" — everything it needs to self-verify (schema, tags, `npm run check`) is
in steps 2 and 6. The gap when parallelizing across many pages at once: agents can't see each
other's `related:` targets or reuse each other's example ideas, so a consistency pass after the
batch (voice, duplicate examples across pages, cross-links that should exist but don't) is still
a separate step, not something this skill covers solo.