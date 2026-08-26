# ADR-0011: Strict `tsc` is the lint config, and there is no ESLint

- **Status:** Accepted, pending an upstream release
- **Recorded:** 2026-08-19
- **Enforced by:** `tsconfig.json`, `tsconfig.client.json`, both run in `npm run check`

## Context

The repository had no lint configuration and had reached the size where that was worth fixing.
ESLint with `typescript-eslint` is the default answer.

It is not available here. **No released `typescript-eslint` supports TypeScript 7**: the peer
range is `>=4.8.4 <6.1.0` on `latest` and on `canary` alike. Forcing it past npm's objection gives
a parser reading the code through the wrong grammar, which produces a check that *lies* rather than
a check that is merely missing. That is worse than nothing, because it is trusted.

## Decision

No ESLint. The TypeScript compiler does the work a lint config usually would, with the strictest
settings the codebase passes:

`strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` and `noFallthroughCasesInSwitch`.

Three configs, because build code and browser code need different lib sets: `tsconfig.json` has no
DOM lib and excludes the two things that need one, `tsconfig.client.json` covers `src/client/**`
(ADR-0013), and `tsconfig.browser-check.json` covers `scripts/browser-check.ts`, which is Node code
whose `page.evaluate()` callbacks run in a page (ADR-0022). All three run in the gate. Widening the
root `lib` instead would collapse them into one and let `document` typecheck everywhere.

## Consequences

A fair amount of the same ground is covered. `noUnusedLocals` and `noUnusedParameters` found two
dead imports the moment they were switched on, and `noUncheckedIndexedAccess` is doing real work
across a codebase full of array and record lookups.

What is genuinely missing is the stylistic and idiom-level rules: consistent naming, exhaustive
switch preferences, import ordering. Those are handled by review rather than by tooling, which is a
real cost and worth being honest about.

Prettier covers formatting, under its own constraints (ADR-0012).

## Revisit when

`typescript-eslint` releases a version whose peer range admits TypeScript 7. At that point this
decision should be reversed rather than merely reconsidered. The strict compiler flags stay
either way, and ESLint adds the layer they cannot reach.
