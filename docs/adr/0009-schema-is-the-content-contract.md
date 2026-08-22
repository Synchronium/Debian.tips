# ADR-0009: The Zod schema is the single source of truth for what a page needs

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `src/content/schema.ts`, `src/content/loader.ts`, `test/schema.test.ts`, `test/loader.test.ts`

## Context

A content contract that lives in documentation is a contract that drifts. Four documents in this
repository described five categories for months after `troubleshooting` and `compare` were added,
because each held its own copy of the list.

The same problem applies to the harness. Anything reading `examples.yaml` with a cast rather than a
parse is asserting a shape it has not checked, and diverges from the generator the first time the
shape changes.

## Decision

`src/content/schema.ts` defines what every page and every example needs, in Zod, and nothing else
restates it. Documents defer to it, including for the list of categories, which is why no other
file names them.

`src/content/loader.ts` validates in a layered order, failing with a specific `ContentError` naming
the first problem: schema shape, then every `tags:` entry exists in `content/tags.yaml`, then slugs
are unique within a category, then every `related:` target exists, then (scripting only)
`order:` values are unique.

Everything that reads content parses through the schema rather than casting to it, the replay
harness included.

## Consequences

A typo'd `related:` slug **fails the build** rather than shipping a 404. Since slugs are unique per
category rather than site-wide, `related:` accepts either a bare slug or `category/slug`, and says
so when a bare one is ambiguous.

`Page` is a discriminated union rather than one interface with optional fields, so a
category-specific field can be added without another optional and another cast at every use site.

Two fields on every example, `level` and `tags`, are validated but **deliberately not rendered by
any template**. They are reserved for a future difficulty badge or filter. They look like dead data
and are not: backfilling them across hundreds of examples later would cost far more than authoring
them accurately now, so keep setting them, and do not "clean them up".

## Revisit when

The schema stops being able to express a distinction the content needs. Adding a category or a
field is ordinary work within this decision, not a revision of it.
