# ADR-0014: CSS and JS are minified with source maps; HTML never is

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `test/assets.test.ts`, and the comment in `src/assets.ts` where someone would go to add HTML minification

## Context

Minification is normally a whole-build setting. Here the answer differs by asset, and it was
measured rather than assumed.

| Asset | raw | gzipped |
| --- | --- | --- |
| `site.css` | 27.4K → 17.0K | 6.7K → 3.8K |
| `search.js` | 3.4K → 1.6K | 1.5K → 0.8K |

Most of the stylesheet saving is comments. This project's CSS explains its own cascade at length,
which belongs in `styles/site.css` and not on the wire.

HTML is where it stops. The saving post-gzip is small (the `awk` page is 131K raw and 19K
gzipped) and the cost is severe: **every documented output on this site is rendered as
`<pre><code>` with literal newlines between the lines.** A minifier that collapses whitespace joins
them, corrupting the one thing the site promises.

Worse, **nothing would catch it.** The replay compares `examples.yaml` against the sandbox and never
looks at the rendered page (ADR-0001). The corruption would ship silently, past a fully green gate.

## Decision

Minify `styles/site.css` and the static scripts under `public/assets/`, each with a source map
written beside it. Do not minify HTML.

Source maps are separate files, so they cost a visitor nothing: a browser fetches one only when
devtools are open. `sourcesContent` is embedded, since `styles/site.css` is not itself served.

## Consequences

The stylesheet's content hash is taken over the **minified** bytes, which are what gets served, so
the URL moves when the served file does rather than when only a comment changed.

The CSS source map names its source `site.css` rather than the hashed output name, since devtools
would otherwise label the original `site.<hash>.css`, which means "the minified file" everywhere
else on the site.

None of this is visible in the rendered HTML, since the page links a hashed filename either way.
That is precisely why it has a test: a break here ships an unreadable stylesheet with no route back
to the source, or a map comment that costs nothing at runtime and quietly disables devtools for a
year.

## Revisit when

HTML page weight becomes a measured problem. The answer then is not a whitespace-collapsing
minifier: it is the inline Shiki styles, which dominate the weight, and which can be cut without
touching a single byte inside a `<pre>`.
