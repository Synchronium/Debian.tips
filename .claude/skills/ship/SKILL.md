---
name: ship
description: Commit and push a change on debian.tips: choosing which gates to run locally first, writing the commit message this repo writes, and pushing without waiting on CI. Use when asked to ship, commit and push, "push it", or to look into a CI failure the user has reported. Not for writing the change itself.
model: sonnet
---

# Ship a change

Three things here are easy to get wrong: which gate a change needs, that the replay cannot run
inside `npm run check`, and that shipping ends at the push.

## 1. Run the right gates

`npm run check` always. Format, every typecheck, tests, build, pagefind, linkcheck, link audit.
It needs only Node, sets `NODE_ENV=production` itself, and is exactly what CI's `check` job runs.

`npm run replay` **as well**, whenever the change touches any of:

| changed | replay |
| --- | --- |
| `content/commands/<x>/examples.yaml` | `npm run replay -- <x>` |
| a prose page with a setup script | `npm run replay -- <slug>` |
| `scripts/fixtures/<x>.sh` or `.skip` | `npm run replay -- <x>` |
| anything under `scripts/lib/` or `src/content/` | **everything**: `npm run replay` |
| `scripts/fixtures/_common.sh`, or the sandbox image | **everything**: every page reads one or the other |
| prose only, no commands or fixtures | nothing |

`npm run replay -- --changed` works that table out from your diff, and is what CI runs on a pull
request. Know the rows anyway, because the shared-library row is the one worth deciding by hand:
the replay imports from `src/content/` as well as `scripts/lib/`, and `normalise.ts` is the sharp
case, used by both sides of every comparison, so a bug in it corrupts a page and then certifies the
corruption. Never push a change to either directory on the strength of one page's replay.

**Let the replay have the machine to itself.** Backgrounding it and carrying on with `npm run
check` is the obvious move and it produces false failures: pages that stand up a local apt
repository and wait for it are what gives under load. A replay that says a true page is lying is
worse than a slow one, and it is the one result here nobody can afford to start discounting.

A green `check` says the generator works. Only the replay says the pages are true.

If the change touches templates, styles or `src/client/`, the two browser gates are worth running
too, against a served build; `CLAUDE.md` has the lines that start one.

## 2. Write the commit message this repo writes

Read `git log` first. Short subject, then prose saying **what was found, not just what changed**:
the failure mode, why this fix is the right one, what was verified and how. If something broke, say
what and how it was proven fixed. If a claim was checked in the sandbox, say so. If something was
left undone, say that too. A bump in the count of passing examples is not a commit message.

GitHub publishes that prose beside the code, so `.claude/reference/voice.md` applies to it. Watch
the closer, since a commit message invites a final sentence restating the change as a lesson.

End with the trailer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 3. Push, and don't wait for CI

`main` is the working branch and pushing to it directly is normal here. Code work stays on `main`
unless the user says otherwise; content work gets a dated branch.

```sh
git push origin main
```

**Then stop.** Do not poll for the run. The gates in §1 are the gates CI runs, so a green local run
has already said what CI will say, and the user watches CI and reports anything red. This is a
standing instruction from the user, not an optimisation to re-derive.

Report what you ran locally and what it said, and move on.

## 4. Deploy is gated on CI

`deploy.yml` triggers on `workflow_run` of CI, pinned to the same `head_sha`. CI green means deploy
runs; CI red means deploy shows **skipped**, which is the gate working rather than a second
failure. Don't wait for this either.

If the user asks whether something reached the site, check the site rather than the workflow:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://debian.tips/<path>/
```

## 5. When CI fails

```sh
gh run view <run-id> --job <job-id> --log-failed
```

A red replay shard names the pages it ran, and `npm run replay -- <page>` reproduces any of them
exactly. Which shard a page landed in never changes its result.

Every CI-only failure this repo has had was environmental, and the causes repeat: architecture
(`arm64` here, `amd64` there), umask, IPv6 being off on a runner, unsorted directory order, races
in `systemctl` and journald, units the page did not start, and the page's own earlier examples
changing what a later one sees. `.claude/reference/verification.md` has each one with the symptom
that identifies it.

Fix the cause rather than re-running the job. If the real output is right and the page is wrong,
`scripts/adopt-real-output.ts` re-captures it.
