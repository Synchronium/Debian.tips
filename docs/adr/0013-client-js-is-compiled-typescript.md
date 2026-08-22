# ADR-0013: Client JavaScript is compiled TypeScript, inlined into every page

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `tsconfig.client.json` in `npm run check`, `clientScript()` in `src/templates/layout.ts`, `test/layout.test.ts`

## Context

The site's client-side behaviour is small: set the theme before first paint, wire copy buttons, open
the search dialog. It was previously hand-written ES5 living inside a string literal in a template.

Two things were wrong with that. Nothing checked it: Prettier globbed `*.ts` and `tsconfig`
included `*.ts`, so a file extracted from the literal was failing a format check nobody ran. And it
was written in ES5 not by choice but because **there was nowhere to compile it**.

## Decision

Client code lives in `src/client/*.ts` as ordinary TypeScript, and is compiled and minified by
esbuild at build time, then inlined into every page.

It is inlined rather than fetched because it runs before and during first paint: the theme script
must run before the page renders or the page renders in the wrong theme first, and a request per
page for this much would cost more than it saves. `search.js` is the exception and is fetched, since
it is only needed once someone searches.

DOM types live in a separate `tsconfig.client.json`. The root config excludes `src/client/**`
deliberately: sharing one config would let `document` typecheck inside the build and the harness,
where referring to it is always a mistake.

## Consequences

The source can be readable, checked and formatted, while what ships is small.

Two details that are easy to undo by accident, both recorded in comments where someone would go to
change them:

- The source is **wrapped in an IIFE before compiling**, rather than using esbuild's
  `format: "iife"`. Both stop top-level names leaking as globals on every page. But `format: "iife"`
  also decides the dynamic `import()` needs CommonJS interop and emits roughly 300 bytes of
  `__toESM` helpers to support it: 1735 bytes against 1275 for the wrapped form.
- The `</script` check runs on the **output**, not the source. Minification can move a string, and a
  page that stops parsing halfway is a bad way to find that out.

The compiled result is cached per build, since the layout runs for every page and neither file
changes between them.

## Revisit when

Client-side behaviour grows past what is reasonable to inline on every page, which roughly means
when the inlined bytes exceed what a separate cached request would cost across a session. The
theme script must stay inline regardless of what happens to the rest.
