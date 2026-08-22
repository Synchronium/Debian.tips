# ADR-0007: The tag registry is curated, with a two-page rule

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `content/tags.yaml` plus the loader's tag validation; the tag-name pattern in `src/content/schema.ts`

## Context

Tags are the subject axis (ADR-0006), which makes them the site's de facto subject index. That only
works if they are few enough to browse and populated enough to be worth clicking.

Freeform tags fail both ways at once. They multiply toward one tag per page, and each new one is a
listing page with a single entry, which is a dead end for the reader who clicked it expecting a
subject.

## Decision

Every tag used in a page's frontmatter or on an example must exist in `content/tags.yaml`, or the
build fails. Before adding one:

- check whether an existing tag already covers the concept;
- require **at least two pages** that will plausibly use it;
- prefer nouns for subject tags and adjectives for audience tags;
- add it in the batch that needs it, not speculatively.

Tag names are validated against `/^[a-z0-9]+(-[a-z0-9]+)*$/`, because they become URL path segments
at `/tags/<name>/`.

## Consequences

Adding a tag is a small deliberate act rather than a side effect of writing a page, and a page
that wants a concept the registry does not have is a prompt to ask rather than to add.

The registry needs watching from the other direction too: a tag with one page is the dead end the
rule exists to prevent, whether it got there by being added early or by the backlog moving on.
`performance` currently has no pages at all, and several have one. Either the backlog fills them or
they should be retired.

Each tag carries a `description`, which its listing page renders as a lede. That is the cheapest
navigation improvement available on the subject axis and it is worth keeping populated.

## Revisit when

The registry stops being browsable, which roughly means when it no longer fits on a screen. The
answer then is retiring dead tags, not a hierarchy of them.
