---
name: write-content-page
description: Author or extend one debian.tips content page (command reference, concept, scripting lesson, recipe, or Debian article) to the site's schema, tiering, and style-guide contract. Use when asked to write, draft, or expand a specific page — e.g. "write the sed page", "add examples for tar", "draft the exit-codes-and-error-handling concept", "write recipe: bulk-rename-files". Not for open-ended "what should we write next" planning — that's PLAN-CONTENT.md §5.
---

# Write a debian.tips content page

One page per invocation. This skill encodes `_PLANS/PLAN-CONTENT.md` as a checklist so every
page — hand-written or agent-written — comes out consistent. Read that file's relevant sections
if anything below is ambiguous; it's the source of prose detail, this is the source of steps.

## 1. Identify the page

From `_PLANS/PLAN-CONTENT.md` §5, find the requested item and note:
- **category** (`commands|concepts|scripting|recipes|debian`) → target directory
- **slug** → directory/file name (command pages: `content/commands/<slug>/`; others:
  `content/<category>/<slug>.md`)
- **tier** (commands only: `flagship|standard|light`, from §5.1) — drives length and example count
- for combined pages (e.g. "join/paste/column"), the primary command is the slug/title; the
  others get their own `##` sections within the same page

If the item isn't in §5, stop and ask before inventing a slug or category.

## 2. Check the schema, not just the plan prose

Read `src/content/schema.ts` — it's authoritative over §3 of the plan if they've ever drifted.
Frontmatter needs `title`, `description` (50–160 chars), `tags` (1–6), `updated` (ISO date, use
today), `category`; command pages also need `tagline` (≤60 chars) and `tier`; scripting pages
need a unique `order`. `related` is optional but every slug in it must exist (or be created in
this same batch).

Check `content/tags.yaml` for the allowed tag set. If the page genuinely needs a concept not in
the registry, stop and ask — new tags mean editing the plan first (§7), not just adding one.

## 3. Match structure and length to page type (PLAN-CONTENT §2)

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
so treat it as the "current Debian stable" the style guide (§4.2) requires:

- Actually run each command with the Bash tool before writing its `output:` block. Copy real
  output, then sanitize hostnames/users to `deb1`/`user`.
- If a command can't be safely or meaningfully run here (needs root, touches real hardware, is
  destructive, needs a package that isn't installed), say so explicitly in your reply instead of
  inventing plausible-looking output — flag it for the user to verify on a real box.
- Destructive examples (`rm`, `dd`, `mkfs`, `chmod -R`, `curl | sh`, etc.) get `danger: true` and
  the description must state the failure mode. Prefer teaching the safe variant first.

## 5. Style guide (apply to every sentence, PLAN-CONTENT §4)

Direct, second person, no fluff, no "In today's fast-paced world." **British English in all
prose** (`colour`, `flavour`, `behaviour`, `sanitised`, `organise`, `-ise` not `-ize`) — but never
touch a real flag, command, package name, or captured output for spelling (`--color` stays
`--color`; a real GNU grep flag). Realistic placeholders (`access.log`, `~/projects`) — never
`foo`/`file1`. Show the short flag in code; mention the long form in prose when it aids memory.
Titles are outcomes ("Find files modified in the last 24 hours"), not syntax ("Using -mtime").
Every page links ≥ 2 related pages using root-relative paths (`/concepts/pipes-and-redirection/`).
Avoid common AI tropes - e.g. em dashes, "it's not X, it's Y", "here's why that matters", and similar. 

## 6. Verify before calling it done

Run `npm run check` (typecheck, tests, build, linkcheck). Fix any schema violation, missing tag,
dead `related` link, or broken cross-link it surfaces — don't hand back a page that fails this.

## Notes for future parallel use (M6)

This checklist is written so it can be handed to a subagent per page with no extra context
beyond "write page X" — everything it needs to self-verify (schema, tags, `npm run check`) is
in steps 2 and 6. The gap when parallelizing across many pages at once: agents can't see each
other's `related:` targets or reuse each other's example ideas, so a consistency pass after the
batch (voice, duplicate examples across pages, cross-links that should exist but don't) is still
a separate step, not something this skill covers solo.