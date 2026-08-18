---
name: ship
description: Commit, push and watch a change through CI and deployment on debian.tips — choosing the right gates to run first, waiting on both CI jobs, and confirming the change is live. Use when asked to ship, commit and push, "push it", or to check on a run that is already going. Not for writing the change itself.
---

# Ship a change

Nothing here is exotic, but four things about this repo are easy to get wrong: which gate a
change actually needs, that the replay cannot run in `npm run check`, that a failed CI shows
Deploy as *skipped* rather than failed, and that a plain `sleep` is blocked in this harness.

## 1. Run the right gates

`npm run check` always. It is typecheck, tests, build, pagefind, linkcheck and the link audit,
needs nothing but Node, and is what CI's `check` job runs.

`npm run replay` **as well**, whenever the change touches any of:

| changed | replay |
| --- | --- |
| `content/commands/<x>/examples.yaml` | `npm run replay -- <x>` |
| a prose page with a setup script | `npm run replay -- <slug>` |
| `scripts/fixtures/<x>.sh` or `.skip` | `npm run replay -- <x>` |
| `scripts/lib/normalise.ts`, `lib/sandbox.ts`, `verify-*.ts` | **everything**: `npm run replay` |
| prose only, no commands or fixtures | nothing |

The shared-library row matters most. `normalise.ts` is used by both sides of every comparison,
so a bug there corrupts a page and then certifies the corruption. Never push a change to it on
the strength of one page's replay.

The replay needs Docker and takes about a minute, which is why it is a separate CI job and not
part of `check`. A green `check` says the generator works; only the replay says the pages are
true.

## 2. Write the commit message this repo writes

Read `git log` before writing one. The convention here is a short subject, then prose that says
**what was found, not just what changed** — the failure mode, why the fix is the right one, what
was verified and how. A bump in the count of passing examples is not a commit message.

If the change was prompted by something breaking, say what broke and how it was proven fixed.
If a claim was checked in the sandbox, say so. If something was left undone, say that too.

End with the trailer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 3. Push, then watch both jobs

`main` is the working branch here and pushing to it directly is normal for this project.

```sh
git push origin main
```

CI runs two jobs in parallel, `check` and `replay`, and they fail for different reasons on
purpose: "the generator is broken" and "a page is lying" want different people looking at them.
Wait for both.

**A plain `sleep` is blocked in this harness.** Poll with an until-loop instead:

```sh
until [ "$(gh run list --limit 1 --workflow=CI --json conclusion -q '.[0].conclusion')" != "" ]; do sleep 20; done
gh run list --limit 3
```

`gh run watch <id> --exit-status --interval 15` also works and prints each step, but it has
returned an HTTP 504 mid-watch on a long run. That is the API timing out, not a job failing —
re-check the run rather than reporting a failure.

## 4. Deploy is gated on CI

`deploy.yml` triggers on `workflow_run` of CI, pinned to the same `head_sha`. So:

- CI green → Deploy runs → the change is live
- CI red → Deploy shows **skipped**, not failed. That is the gate working. Do not report it as a
  second failure.

Confirm a content change actually reached the site rather than trusting the workflow:

```sh
until [ "$(curl -sS -o /dev/null -w '%{http_code}' https://debian.tips/<path>/)" = "200" ]; do sleep 15; done
```

Deploy occasionally logs `Back off … before retry` or a 503 fetching an action from GitHub's CDN
and then succeeds. Check the conclusion, not the annotations.

## 5. When CI fails

```sh
gh run view <run-id> --job <job-id> --log-failed
```

The replay names the first line that differs and the mode it ran in. Every CI-only failure this
repo has had was environmental, and the same five causes keep coming back:

- **architecture** — `arm64` locally, `amd64` on the runner. No page may print one.
- **umask** — a `docker exec` inherits the *host's* umask, 0000 here and 0022 on a runner. The
  replay pins 0022; a bare `scripts/sandbox.sh exec` does not.
- **IPv6** — a runner often has it disabled, so anything bound to `::1` fails. Use `127.0.0.1`.
- **directory order** — `find`, `grep -r` and globs follow readdir order. Needs an explicit
  `sort`.
- **races** — `systemctl start` returns before a `Type=simple` service is ready; journald writes
  asynchronously. A page that passes locally three times can still be racing.

Fix the cause rather than re-running the job. If the real output is right and the page is wrong,
`scripts/adopt-real-output.ts` re-captures it.
