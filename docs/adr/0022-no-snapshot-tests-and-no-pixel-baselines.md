# ADR-0022: No snapshot tests and no pixel baselines

- **Status:** Accepted
- **Recorded:** 2026-08-26
- **Enforced by:** nothing mechanical, since a `__snapshots__` directory or a folder of baseline
  images is unmissable in a diff; `scripts/browser-check.ts` holds the ground a visual regression
  suite would have been bought for

## Context

This repository already compares stored output against fresh output, on every push, over every
example on the site. The replay harness (ADR-0001) is a snapshot test in every mechanical sense:
`examples.yaml` holds golden values, `scripts/adopt-real-output.ts` is the button that re-records
them, and a run is a diff.

It works for one reason, and the reason is not the mechanism. **The golden value is produced by an
independent oracle.** A real Debian container in a real shell printed it, and the code under test
had no say in what it said. That is what makes a passing replay evidence rather than a tautology.

So "should we add snapshot tests?" is really two questions, and only the second is open: the site
already has the one snapshot test it has an oracle for, and the question is whether to extend the
technique to places where it has none.

Two such places were proposed:

- **Rendered HTML**, via `expect(renderPage(page)).toMatchSnapshot()`.
- **Rendered pixels**, via a screenshot suite with committed baseline images.

## Decision

**Neither. What the site renders is checked by assertions that name the property they are
checking, in the unit tests and in the browser gates alike.**

For HTML, the golden value would be produced by the templates being tested. Accepting it records
what the code does, which was already known; the test can then only ever report *that* something
changed, leaving a human to decide whether it should have. That is what code review is. The failure
mode is not hypothetical either: a broad breakage and a broad intentional change present
identically, as several dozen files of near-identical markup, and the pressure at that moment is to
re-record rather than to read. A snapshot suite is weakest exactly when it is most needed.

There is a second cost specific to this repository. Every page links to the files that produced it
(ADR-0017), so a reader arriving to check whether a claim is really checked lands in `test/`. The
tests there state their reasoning; `test/pageChecks.test.ts` and `test/pa11yUrls.test.ts` are the
shape. A directory of serialised markup would be the first thing under `test/` that explains
nothing to that reader.

For pixels, the blocker is the one ADR-0004 already names. Font rasterisation and subpixel
positioning differ between the `arm64` devcontainer and the `amd64` runner, so a baseline captured
locally does not match CI. Unlike an output block, a screenshot cannot be exempted or masked into
agreement. The workaround is to capture baselines in CI only, which means a failure cannot be
reproduced locally and every deliberate style change ships as a red gate blessed from a diff image:
the re-record reflex above, with a slower loop.

**What replaces the visual suite is a property.** `scripts/browser-check.ts` loads the same URLs
the accessibility gate checks, at a 320px viewport, and asserts that the document does not scroll
horizontally. Horizontal overflow on a narrow screen is the layout regression that is both
plausible here (wide `<pre>` blocks of command output, long unbroken paths, the tag pills) and
invisible until a reader hits it. It is a single integer comparison, identical on both
architectures, and it needs no baseline to bless.

Colour contrast, the other visual property worth guarding, is already covered: `pa11y-ci` runs
`WCAG2AA` (ADR-0016).

## Consequences

The generator's markup is checked by assertions that say what they are checking. `test/` stays
readable by the person who followed a link from a page, and the answer to "what does this test
protect?" is in the file rather than in a stored artefact.

The gap left open is worth naming: a refactor of the templates can change markup nobody asserted,
and nothing will say so. The Prettier incident behind ADR-0012 was exactly that shape, and it was
found by reading a diff. This record accepts that class of change being caught by review, on the
grounds that a snapshot suite would have presented it as a wall of red files and been re-recorded.

Adding a browser to the gates costs two things. `puppeteer` is a direct devDependency rather than
something inherited from `pa11y-ci`, so the Chromium download is declared where Dependabot can see
it instead of arriving as a transitive surprise.

The other is a third TypeScript project. `scripts/browser-check.ts` is Node code that contains
browser code, because the callbacks it passes to `page.evaluate()` run inside the page, so it needs
`node:fs` and `document` in one file and neither existing config can say that.
`tsconfig.browser-check.json` covers that one file. Adding `DOM` to the root `lib` instead was
tried and reverted: it makes `document` typecheck across the whole build and harness, which is what
ADR-0013 separated the configs to prevent, and the failure it lets through appears only at runtime.

## Revisit when

The templates are being restructured broadly enough that reviewing the markup diff by hand stops
being credible. A snapshot taken deliberately for one refactor, read once and deleted, is a
different thing from a standing suite, and this record is not an argument against that. The other
condition is the two architectures rendering identically, which would leave the pixel case resting
on the re-record objection alone.
