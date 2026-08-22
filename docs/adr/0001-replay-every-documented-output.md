# ADR-0001: Every documented output is replayed against a real Debian container

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `scripts/replay-command-page.ts`, `scripts/replay-prose-page.ts`, `npm run replay`, the `replay` job in `.github/workflows/ci.yml`

## Context

A tips site is worth reading only if the commands on it work. Output written from memory is the
failure mode, and it is a quiet one: plausible output reads exactly like real output, and nothing
in a normal toolchain can tell them apart. Schema validation, `tsc`, the tests and the link check
will all pass a page whose output no command has ever produced.

This is not hypothetical here. The first prose page put through the replay, `apt-essentials`, had
**four broken output blocks out of four**: two silently abridged (a `dpkg -l` whose five-line
header had been trimmed away; a fence running three commands but showing only the third's output)
and two simply drifted with the distribution (`13.5` to `13.6`, `deb13u3` to `deb13u4`). It had
been wrong for months and nothing in the repository could have said so.

Drift also means a page that was true when written does not stay true. A check that runs once, at
authoring time, does not solve this problem.

## Decision

Every `output:` block on a command page, and every command/output fence pair on a prose page, is
re-run inside a disposable `debian:trixie` container and diffed against what the page claims. This
runs on every push, not only when a page is written.

The two gates do different jobs. **`npm run check` validates shape (schema, types, links) and
would happily pass a lying page. Only `npm run replay` checks that the claims are true.** Neither
substitutes for the other.

Three rules follow directly, and each has been broken here at least once:

1. Never write output from memory. Run the command in the sandbox and paste what it printed.
2. Never document an architecture (ADR-0004).
3. Assume another page can see what your fixture changes (ADR-0002).

## Consequences

Writing a page costs more. Sample data has to be declared in a `fixtures:` block *and* recreated
by `scripts/fixtures/<slug>.sh`, and the replay checks that those two agree. A fixture that does
not reproduce the documented output is worse than no fixture, because it looks like evidence.
Verifying sometimes means installing a package or standing up a service, which is what the
disposable container is for.

Some examples cannot be replayed at all, and some produce output that cannot repeat byte for byte.
Both are handled explicitly rather than by exception (ADR-0005).

In exchange the site can make a claim almost no comparable site can, and back it with figures
counted from the content at build time rather than asserted in prose. `/about/` says how many
outputs are re-run on every push because the build counts them.

## Revisit when

Not a candidate for revision. This is the product rather than an implementation choice: if it
goes, the site is just another tips site. The things worth revisiting are *how* the replay runs
(ADR-0002, ADR-0003), not whether it does.
