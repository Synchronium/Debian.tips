# ADR-0010: The site generator is hand-written, with no framework

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** nothing automated — `package.json` has no framework dependency, and that is the whole of it

## Context

The obvious alternatives are the good ones: Astro, Eleventy, Hugo. Any of them would have got a
static site up faster than writing one.

What this site needs from its output is unusual, though, and all of it points the same way. Every
page is mostly `<pre>` blocks whose exact bytes are the product (ADR-0001). The page weight that
matters is dominated by inline syntax-highlighting styles rather than by application code. There is
no interactivity beyond a theme toggle, a copy button and a search dialog. And the build has to run
several checks — a link audit, an accessibility pass, a replay harness — that address the content
model directly rather than the rendered page.

A framework would sit between the content model and all of that, and would be carried for
conveniences this site does not need.

## Decision

Markdown and YAML content, validated by a Zod schema, rendered through hand-written template
functions, highlighted with Shiki, indexed by Pagefind, emitted as plain HTML/CSS/JS to GitHub
Pages. No client-side framework, no bundler dev server.

`src/html.ts` provides the one piece a framework would otherwise supply: a tagged template `html`
that auto-escapes every interpolation unless wrapped in `raw()`, joins arrays with no separator,
and renders `null`/`undefined`/`false` as empty. **Content is never concatenated into HTML
directly** — that tagged template is the escaping boundary, and going around it is how escaping
breaks.

## Consequences

Full control over the emitted bytes, which is what makes ADR-0014 decidable at all: knowing that
documented output renders as `<pre><code>` with literal newlines between lines is only possible
because a template in this repository put it there.

More code to own, and the ordinary things a framework gives away have to be built: pagination,
feeds, sitemaps, a dev server. All of them exist and are small.

The dev server is a plain `node:http` server that does a full rebuild on change and serves the
result. No HMR, and rebuild time is a whole-site cost that will eventually need attention.

## Revisit when

The generator starts costing more to maintain than it saves — most plausibly if the site grows
interactive surfaces that want a component model. Content volume alone is not the trigger; build
performance under it might be, and that is a narrower problem than adopting a framework.
