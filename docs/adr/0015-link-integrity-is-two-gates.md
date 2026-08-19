# ADR-0015: Link integrity is two separate checks, not one

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `src/linkcheck.ts` and `scripts/link-audit.ts`, both in `npm run check`; `scripts/lib/linkGraph.ts` with `test/linkGraph.test.ts`

## Context

"Are the links OK?" is two questions, and only one of them is the one a link checker answers.

**Do the links that exist resolve?** A typo'd `related:` slug, a renamed page, a `#fragment`
pointing at a heading that was retitled. Ordinary link checking.

**Do the links that *should* exist, exist?** A new page arrives orphaned by construction — its own
`related:` list points outward, and nothing on the site knows it is there. Every link on it
resolves. A link checker is perfectly happy. The page is unreachable by anything except search, and
until this existed nothing in the repository noticed.

The second question is the one that decides whether content is findable, and it needs a graph
rather than a crawl.

## Decision

Two checks, both in the gate.

`src/linkcheck.ts` walks every emitted HTML file after the build, extracts `href` and `src`, and
verifies internal links resolve to real files and `#fragment` links resolve to a real `id` in the
target page.

`scripts/link-audit.ts` builds a graph from `related:` frontmatter plus every root-relative link in
prose, example descriptions, section intros and fixture notes, then reports:

- **orphaned** — nothing links here. Fails the build.
- **thin** — links to fewer than two other pages. Fails the build.
- **weakly linked** — reachable from exactly one other page. Advisory, printed as a count unless
  `--verbose`.

## Consequences

Writing a page is not finished when the page is good. Something has to link *to* it, and the useful
link is almost always an inline one on a sentence in an existing page that already raises the
question the new page answers — not another `related:` entry. That editorial half is
`.claude/skills/cross-link-pages/SKILL.md`.

The third finding is advisory on purpose. The gate runs on every push, and an advisory list nobody
reads is worse than no list.

The graph has its own tests, on the same reasoning as `normalise.ts` in ADR-0005: a *missing* edge
invents an orphan, which is noisy but visible, while an *invented* edge hides a real orphan behind a
clean report. Heading anchors — which rehype-autolink-headings puts on every `##` — and self-links
are the two that would do it, and both are pinned by a test.

Drafts are exempt from both failing checks, since the loader already rejects a published page
linking to a draft, so a draft could never be anything but an orphan.

## Revisit when

The advisory finding needs to become a failure, or a third question turns up that neither check
asks. The obvious candidate is external links, which nothing currently validates at all.
