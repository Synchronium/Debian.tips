# ADR-0008: Command pages are a directory with a structured `examples.yaml`

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `loadCommands` in `src/content/loader.ts`, `src/content/schema.ts`, `test/loader.test.ts`

## Context

A command page is mostly examples, and each example carries more than prose can hold: a title, the
code, a description, the expected output, a difficulty level, tags, a danger flag, a volatility
note. The replay has to address each of those individually — to run *this* code and diff *that*
output, and to know that this one is exempt and that one compares by shape.

Markdown fences cannot carry that. Everything around a fence is prose, and prose is not
addressable.

## Decision

`commands` is the one category stored as a directory: `content/commands/<slug>/index.md` for
frontmatter and prose, paired with `content/commands/<slug>/examples.yaml` for structured sections
of tested examples. Both files must exist, and the examples file's `command:` field is cross-checked
against the directory name.

Every other category is a flat `content/<category>/<slug>.md`. Their claims are stated as a
fenced `bash` block followed immediately by the output it produced, and `scripts/verify-prose.ts`
pairs the two up — a looser convention, and the right one, because on those pages the commands are
incidental to an argument rather than the substance of the page.

Sample data is declared **twice, deliberately**: as a `fixtures:` block in `examples.yaml`, which is
what the reader sees, and as `scripts/fixtures/<slug>.sh`, which recreates it in the sandbox. The
replay checks the blocks themselves as well as the outputs, so the two cannot drift apart silently.

## Consequences

Two files per command page to keep in sync, and the loader fails the build rather than rendering
half a page if one is missing.

Because setup scripts are named `scripts/fixtures/<slug>.sh` and slugs are unique per category
rather than site-wide, two pages sharing a slug cannot both have one. That has not bitten yet and
is worth remembering before it does.

The duplication of sample data is the point rather than an oversight: a fixture that does not
reproduce the documented output is worse than no fixture, because it looks like evidence. A block
that is not one file's literal contents sets `from:` to the command that reproduces it, so every
rendered block stays something a reader could actually produce.

Prose pages opt into replay simply by having a setup script. Without one they are reported as *not
replayed* rather than passed over silently, so the gap is visible.

## Revisit when

Another category's examples become substantive enough to need addressing individually. The
`troubleshooting` pages are the nearest candidate; they are still prose-shaped today.
