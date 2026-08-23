# ADR-0018: One self-hosted display face, held to a byte budget

- **Status:** Accepted
- **Recorded:** 2026-08-23
- **Enforced by:** `test/assets.test.ts` ("the byte budget"), which caps the stylesheet and asserts the built site ships exactly one `.woff2`

## Context

The site was set in one family, `system-ui`, at seven sizes close enough together that nothing led.
Hierarchy came from bordered panels instead, so a page arrived as a stack of similar boxes and
read as a hobby project. A reference site has three kinds of text in it: the title of a page, the
prose explaining it, and the things a reader will type. A design that cannot tell them apart is
throwing away the clearest signal it has.

Fixing that with type needs a face the system stacks do not provide. The generic `serif` keyword
resolves to Times on most machines and to something else on each of the others, so a design that
depends on it is not the same design twice.

Adding a webfont is the first thing on this site that costs every visitor bytes for a purely
visual reason.

**Delivery is a separate question from licence, and the two are easy to confuse.** Google Fonts
families are OFL or Apache-2.0; both permit redistribution, so self-hosting one is exactly as
licensed as linking it. The CDN is not the safer option on that axis, and it is the riskier one on
another: a German court held that embedding Google Fonts dynamically transmits the visitor's IP to
a third party without consent, breaching the GDPR (LG München I, 20 January 2022, 3 O 17493/20).
Self-hosting is the standard remedy. The performance argument that used to favour the CDN, a
shared cache across sites, ended when browsers partitioned the HTTP cache in 2020.

## Decision

The site ships **exactly one webfont**: Source Serif 4, weight 600, Latin subset, `woff2`, used for
page titles and nothing else. Prose keeps the system sans stack and code keeps the system mono
stack, so no text a reader spends time in depends on a download.

It is **self-hosted from our own origin**, taken from the `@fontsource/source-serif-4` npm package
at build time rather than committed as a binary, so the version sits in `package.json` where
Dependabot can see it. No third-party origin is contacted for any asset.

It is served under a **fixed filename** rather than a content hash, unlike the stylesheet: the
stylesheet has to name the font's URL, so hashing the font would mean substituting that hash into
the CSS before hashing the CSS, leaving `styles/site.css` something other than a stylesheet.
`FONT_FILE` in `src/paths.ts` is the name; changing the package means changing it.

The font is `preload`ed in the document head and declared `font-display: swap`. Because it is
confined to headings, a swap can never reflow a paragraph.

**A byte budget is part of the decision, not a follow-up.** `test/assets.test.ts` caps the
minified and gzipped stylesheet and asserts the built site contains one `.woff2` under 30 KB. The
ceilings have room to work in, so crossing one is a decision somebody makes in a diff that says
so, rather than a drift nobody sees.

## Consequences

First-visit cost for a page is roughly 5 KB of gzipped HTML, 5 KB of gzipped CSS and 21 KB of
font, on one origin, with no blocking third-party request. The font is the largest single asset
the site serves, which is the reason the budget covers it.

Three families now carry meaning, and the mono one carries the most: mono means "something you
could type" and nothing else, so a command name in a listing reads as a command without any other
decoration.

The stylesheet grew from 16.5 KB to 23.7 KB minified (3.6 KB to 5.2 KB gzipped) in the redesign
that introduced this, which is inside the budget and expected to stay there.

The budget measures the stylesheet **without** the syntax-highlighting rules appended at build
time. Those are derived from content rather than written, so a build that added a language to a
page would count against a ceiling nobody could act on.

ADR-0014 is unaffected: `woff2` is already compressed and is copied verbatim, so it is neither
minified nor a counterexample to "CSS and JS are minified".

## Revisit when

A second weight or a second family is genuinely needed, most likely an italic for the display
face. It doubles the largest asset on the site, so take it against the budget rather than around
it.

Also revisit if `size-adjust` metric-override fallbacks become worth the complexity. They are not
today, because the preload keeps the swap window short and the fallback stack
(Charter, Iowan Old Style, Georgia) is metrically close enough that the swap is not distracting.
