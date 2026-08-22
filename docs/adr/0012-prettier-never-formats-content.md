# ADR-0012: Prettier never formats `content/`

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `.prettierignore` (which explains the reasoning at length), the `format:check` globs in `package.json`

## Context

Formatting `content/` looks like exactly the sort of consistency win a formatter is for. It is the
opposite. **The whitespace in those files decides what the site claims, so reformatting them would
change it silently.**

Three specific ways:

- `examples.yaml` uses `output: |2` blocks to preserve the column padding of commands that
  right-align their output (`wc`, `uniq -c`). Re-indenting such a block changes the documented
  output while leaving it looking fine.
- Prose pages pair a bash fence with the output fence that opens on the **immediately** following
  line. Anything that moves a blank line breaks the pairing, and the page then reports as having
  nothing to check rather than as broken.
- `<!-- verify: -->` directives must sit on the line directly above their fence.

The worst case is not a broken build. In the `|2` case the replay would re-adopt and **re-certify
the altered claim**, which is the single worst outcome available in this repository.

## Decision

Prettier is scoped to `src/`, `scripts/`, `test/` and `styles/`. `content/` is never formatted, and
neither is Markdown anywhere else, since prose here is wrapped by hand and reflowing it produces
large diffs and no benefit.

`embeddedLanguageFormatting` is `off`.

## Consequences

That last setting is not a style preference either. Prettier recognises the `html` tagged template
(ADR-0010) and formats the HTML inside it, so the first run **rewrote the markup of every page on
the site**: the 404 page went from 77 lines to 116. It was caught only by building the site before
and after and diffing `dist/`, which is now the way to verify any change to formatting
configuration.

Content consistency is therefore a review concern rather than a tooling one, and the authoring
skill carries the conventions that a formatter would otherwise enforce.

## Revisit when

Never for `content/`. The `embeddedLanguageFormatting` setting could be revisited if the templates
stop using tagged templates for HTML, which is not planned.
