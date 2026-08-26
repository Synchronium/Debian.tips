# ADR-0016: Accessibility is a build gate, and its URL list is generated

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `npm run a11y` in `.github/workflows/ci.yml`, with its URL list generated and checked for completeness by `scripts/pa11y-urls.ts`, covered by `test/pa11yUrls.test.ts`

## Context

Accessibility treated as a review step is accessibility that regresses between reviews. On a site
that is almost entirely text and code blocks, the failure modes are also narrow and highly
checkable: contrast, headings, landmarks, focus states, form labels.

The subtler problem is coverage. A hand-maintained list of URLs to check silently stopped covering
two whole categories that were added after it was written. It kept passing, on a shrinking fraction
of the site, and said nothing about it.

## Decision

`pa11y-ci` runs in CI against the built site, as a step in the `check` job after the build has
happened and `dist/` is being served.

**Its URL list is generated from the sitemap the build just wrote**, by `scripts/pa11y-urls.ts`.
Nobody maintains it by hand.

## Consequences

A new category or a new page shape is covered the day it exists, rather than the day someone
remembers to add it. The list is 19 URLs against 51 pages (2026-08-23), because it grows with the
site's shapes rather than with its page count.

Contrast is checked, which matters because two `github-light` Shiki token colours **fail WCAG AA
against this site's light background** and are patched after rendering (`LIGHT_CONTRAST_FIXES` in
`src/content/markdown.ts`). That patch is only safe to remove by re-checking contrast, and this gate
is what would catch its removal.

It runs the same way locally: build, serve `dist/`, `npm run a11y`. That one command generates the URL list and then checks it, because `pa11y-ci` exits 0 on an empty list and so cannot be trusted to notice that it was given nothing.

## Revisit when

The generated list grows large enough that the job dominates CI time. The answer then is sampling by
page shape rather than dropping to a hand-maintained list, which is the arrangement this replaced.
