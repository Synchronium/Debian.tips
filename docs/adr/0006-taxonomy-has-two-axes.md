# ADR-0006: `category` is a page's shape, `tags` are its subject, and there are no subcategories

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `CATEGORIES` in `src/content/schema.ts` and the comment on it, `test/categories.test.ts`, the loader's tag validation

## Context

As the content grows, the instinct is to add hierarchy: `/commands/networking/`,
`/commands/text-processing/`. It is the wrong instinct here, and the reason will recur.

The site already sorts every page twice, on axes that are genuinely independent. A subcategory
would be a third axis that in almost every case restates the second one: `/commands/networking/`
and `/tags/networking/` would hold nearly the same pages. The tag version is the correct one,
because it is many-to-many: `rsync` is a networking command *and* a files command, and a
subcategory forces a choice that has no right answer.

## Decision

**`category` is the page's shape**: how it is written and how a reader consumes it.
**`tags` are the page's subject**: many-to-many, with a listing page per tag. There is no third
axis. `src/content/schema.ts` is where the categories are defined, and nothing else lists them.

Each category has a one-line test, phrased as what the reader arrived with, so filing a page does
not need deliberation:

| Category | The reader arrives with | Test |
| --- | --- | --- |
| `commands` | a tool's name | "I know it's `xargs`, I want to use it well." |
| `concepts` | a why | "But how does that actually *work*?" |
| `scripting` | nothing yet | Read in order; each page assumes the last. |
| `recipes` | a goal | "I want to achieve X." |
| `troubleshooting` | an error message | "X broke, and here is what it printed." |
| `compare` | two options | "X or Y, and nobody told me how to choose." |
| `debian` | a why, about Debian | An explainer that would be *wrong* elsewhere. |

Two tiebreaks settle the awkward cases. **Goal or error?** `recipes` and `troubleshooting` split on
how the reader arrived, not on subject: "free up disk space" is a recipe, "No space left on device"
is troubleshooting, and both are worth having. **Does it survive deletion?** If a comparison page
still says something useful with one of its two subjects removed, it is a concept page wearing a
comparison title.

`debian` is the one category on the subject axis rather than the shape axis. That is a product
decision (the site is called debian.tips) and it is bounded rather than open: **`debian` is the
Debian wing of `concepts`**. Anything with a Debian subject but another shape files under that
shape and takes the `debian` tag.

## Consequences

The apt error pages are `troubleshooting`, tagged `debian` and `apt`. `apt vs apt-get` is
`compare`. Without the bound, all of them would have landed in `debian` and it would have grown to
a sprawl instead of a browsable dozen.

On-page grouping of the commands listing is a static lookup table, `COMMAND_GROUPS` in
`src/config.ts`, not a frontmatter field, which is the same decision applied to layout. A command
page not added to a group falls through to a "More commands" catch-all.

The one place hierarchy is genuinely needed is an **ordered sequence**, where "which lesson is
next" is real information neither axis carries. `order:` on scripting pages does exactly that, and
it is deliberately narrow.

Documents must defer to `CATEGORIES` rather than restating it. Four of them named five categories
for months after `troubleshooting` and `compare` were added, which is exactly the failure a
duplicated list produces.

## Revisit when

A genuinely new *shape* of page appears, one whose reader arrives with something none of the seven
tests describes. That is a new category. Wanting to group existing pages by subject is not; that is
what tags already do.
