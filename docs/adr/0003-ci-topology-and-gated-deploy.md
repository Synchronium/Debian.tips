# ADR-0003: Replay is a separate CI job, and deploy is gated on CI passing the same commit

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

## Context

Two very different things can be wrong with a change here, and they want different people looking
at them: **the generator is broken**, and **a page is lying**. Folded into one job, they arrive as
one red X and the log has to be read to tell them apart.

The replay also needs Docker and its own image. A gate that cannot run without a daemon is a gate
contributors skip, and `npm run check` is meant to be the everyday one.

Separately, deployment used to run on every push to `main` independently of CI. A red build went
live anyway, whether it was a broken link, a failing test or a page whose examples no longer
reproduced, and the badge and the site disagreed.

## Decision

CI runs two jobs in parallel:

- **`check`**: format, typecheck (both configs), tests, build, pagefind, linkcheck, link audit,
  then `pa11y-ci` against the built site. Needs nothing but Node. This is exactly what
  `npm run check` runs locally, and it sets `NODE_ENV=production` itself so drafts are excluded in
  both places.
- **`replay`**: builds the sandbox image, then replays pages, each in a container of its own. A
  pull request replays only what its diff touched; a push to `main` replays everything.

There was a third job, `replay-shuffled`, which replayed the whole site again in a seeded random
order. [ADR-0020](0020-one-container-per-page.md) removed it: pages no longer share a container,
so the order they run in cannot reach any result and a job that varied it could never fail.

Deploy triggers on `workflow_run` of CI, runs only when `conclusion == 'success'`, and checks out
`github.event.workflow_run.head_sha` rather than the tip of the branch.

## Consequences

A failure names its own kind before anyone opens the log: "the generator is broken" and "a page is
lying" are different problems and want different people looking at them.

`npm run check` is runnable on any machine with Node, which is why it is the thing to run before
treating a change as done. The replay is a deliberate second step, run when the change touches
content, fixtures or the harness.

**A red CI shows Deploy as *skipped*, not failed. That is the gate working, and it should not be
reported as a second failure.**

Pinning to `head_sha` closes a real hole: a `workflow_run` job otherwise checks out the tip of the
default branch, so a quick second push would be deployed under the previous run's approval, having
been verified by nothing. `workflow_dispatch` stays available for a manual re-deploy.

## Revisit when

Image build time comes to dominate a replay job. It is around 22 seconds against roughly 290 for a
full replay, and the workflow builds the image as its own step precisely so the log says which half
any slowness is in. Caching the image is the next lever and is not worth its failure modes yet.

ADR-0020's "Revisit when" covers the other half, which is what to do about the replay's total run
time now that there is one replay job rather than two.
