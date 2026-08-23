# ADR-0019: The header nav is grouped, not one item per category

- **Status:** Accepted
- **Recorded:** 2026-08-23
- **Enforced by:** `test/categories.test.ts`, which fails if any of `CATEGORIES` is missing from `NAV_GROUPS` or appears in two of them

## Context

The header carried one link per category. At seven categories it was already the widest thing in
the header, and the content backlog has an eighth category in it.

An eighth link is not a cosmetic problem. The header wraps to a second line, and
`--header-height` in `styles/site.css` is a hand-measured constant that every anchor jump on the
site depends on: the TOC links, the example permalinks, and the sticky TOC's own offset. When the
header grows, every one of those lands underneath it. Nothing catches that, and nothing can, so
the failure arrives as a reader clicking a TOC entry and seeing the wrong thing.

Adding a category should be a content decision rather than a layout one. A nav that has to be
re-thought each time quietly discourages the categories the site should have.

Grouping was already the intended fix, and it was deferred until a seventh category had pages in
it. It now does.

## Decision

The header renders `NAV_GROUPS` from `src/config.ts`, not `NAV_ORDER`. A group holding one
category is a plain link; a group holding several is a disclosure menu. The header is three items
wide, and stays three items wide however many categories exist.

The groups today are **Commands** (the reference) and **Guides** (everything else), plus the
standalone **About** page. `StandalonePage` grew a `headerLabel` because the header has less room
than the footer, and "About" is the wording that belongs in a nav even though the page is called
"How this site is tested".

**Every category appears in exactly one group**, so nothing is reachable only by search.

The disclosure is a nested `<details>`, not scripted. It opens by keyboard and without JS, and the
mobile menu it sits inside is the same element type, so there is one behaviour rather than two
implementations of it.

**`NAV_ORDER` survives, with a narrower job.** It is the editorial order for the homepage, the
footer and the sitemap. Reading order and header layout are different questions; collapsing them
made the header grow with the content model.

## Consequences

The subject axis carries most of the navigation now. `HOME_TOPICS` on the homepage points at tag
pages rather than category listings, because a reader arrives wanting "networking" rather than
"recipes" (ADR-0006). The header answers "what kind of thing is this", which needs less room.

"Guides" is a broad label for six categories. It has to get a reader into the menu, not describe
what is in it.

Adding a category is now two lines: `NAV_ORDER` for reading order, `NAV_GROUPS` for where it
appears. Forgetting the second fails the test rather than silently orphaning the category.

`--header-height` stays hand-measured, and stays the thing to check when the header changes. This
decision removes the most likely reason for it to change, but it does not make it verifiable.

## Revisit when

"Guides" holds enough categories that the menu itself needs grouping, or a category arrives that
belongs in neither group. Splitting Guides into "Learn" and "Solve" is the obvious next shape, and
it is a change to one array rather than to the header.
