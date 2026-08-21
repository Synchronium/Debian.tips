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

Separately, deployment used to run on every push to `main` independently of CI. A red build — a
broken link, a failing test, a page whose examples no longer reproduced — went live anyway, and the
badge and the site disagreed.

## Decision

CI runs three jobs in parallel:

- **`check`** — format, typecheck (both configs), tests, build, pagefind, linkcheck, link audit,
  then `pa11y-ci` against the built site. Needs nothing but Node. This is exactly what
  `npm run check` runs locally, and it sets `NODE_ENV=production` itself so drafts are excluded in
  both places.
- **`replay`** — builds the sandbox image, then replays pages. A pull request replays only what its
  diff touched, shuffled; a push to `main` replays everything in the default `alpha` order.
- **`replay-shuffled`** — the full replay again, on a push to `main` only, in a random order seeded
  from the commit SHA. GitHub gives each job its own runner, so this is genuinely parallel with
  `replay` above: no wall clock and, more to the point, no CPU contention between two replays.
  ADR-0002 records why one ordering is not the assertion.

Deploy triggers on `workflow_run` of CI, runs only when `conclusion == 'success'`, and checks out
`github.event.workflow_run.head_sha` rather than the tip of the branch.

## Consequences

A failure names its own kind before anyone opens the log: "the generator is broken", "a page is
lying", and "a page is only true in one ordering" are three different problems.

**`replay-shuffled` gates deployment, and that is deliberate.** Deploy keys off the whole
workflow's conclusion, so a failure there holds the site back — including when the ordering it
happened to pick surfaced a latent defect in a page the commit never touched. That is the intended
trade: a page which is only true in one ordering is not true, and every other check here is a hard
gate rather than an advisory one. `continue-on-error: true` on that job is the single line that
changes it, if the interruption ever costs more than the defects it catches.

`npm run check` is runnable on any machine with Node, which is why it is the thing to run before
treating a change as done. The replay is a deliberate second step, run when the change touches
content, fixtures or the harness.

**A red CI shows Deploy as *skipped*, not failed. That is the gate working, and it should not be
reported as a second failure.**

Pinning to `head_sha` closes a real hole: a `workflow_run` job otherwise checks out the tip of the
default branch, so a quick second push would be deployed under the previous run's approval, having
been verified by nothing. `workflow_dispatch` stays available for a manual re-deploy.

## Revisit when

Image build time comes to dominate a replay job. It is around 22 seconds against roughly 215 for a
full replay, and the workflow builds the image as its own step precisely so the log says which half
any slowness is in. Caching the image is the next lever and is not worth its failure modes yet.

Also revisit if `replay-shuffled` starts holding back deployments for defects unrelated to the
commit often enough to be disruptive. The lever is named above; ADR-0002's "Revisit when" covers
the other half, which is what to do about the replay's total run time.
