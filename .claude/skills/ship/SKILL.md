---
name: ship
description: Commit and push a change on debian.tips: choosing which gates to run locally first, writing the commit message this repo writes, and pushing without waiting on CI. Use when asked to ship, commit and push, "push it", or to look into a CI failure the user has reported. Not for writing the change itself.
---

# Ship a change

Nothing here is exotic, but three things about this repo are easy to get wrong: which gate a
change actually needs, that the replay cannot run in `npm run check`, and that shipping ends at
the push, and CI is the user's to watch rather than something to poll.

## 1. Run the right gates

`npm run check` always. It is the format check, typecheck, tests, build, pagefind, linkcheck and
the link audit; it needs nothing but Node, and it is exactly what CI's `check` job runs. It sets
`NODE_ENV=production` itself, so drafts are excluded here the same way they are there.

`npm run replay` **as well**, whenever the change touches any of:

| changed | replay |
| --- | --- |
| `content/commands/<x>/examples.yaml` | `npm run replay -- <x>` |
| a prose page with a setup script | `npm run replay -- <slug>` |
| `scripts/fixtures/<x>.sh` or `.skip` | `npm run replay -- <x>` |
| anything under `scripts/lib/` or `src/content/` | **everything**: `npm run replay` |
| `scripts/fixtures/_common.sh`, or the sandbox image | **everything**: every page reads one or the other |
| prose only, no commands or fixtures | nothing |

There is no "run it twice in different orders" row any more. Each page is replayed in a container
of its own (ADR-0020), so `npm run replay -- <x>` puts the page in the same state the full run
does, and no ordering exists for it to be true in and false out of.

`npm run replay -- --changed` works out that table from your diff, which is the same thing CI runs on a
pull request. The rows above are still worth knowing, because it is the shared-library row that
decides whether "everything" is the right answer.

The shared-library row matters most, and it is wider than it looks: the replay imports from
`src/content/` as well as `scripts/lib/`: the fence-pairing rule, the partition, the exemption
parser and the comparison vocabulary all live there, and `--changed` treats both directories as
harness-wide for that reason. `normalise.ts` is the sharpest case, used by both sides of every
comparison, so a bug in it corrupts a page and then certifies the corruption. Never push a change
to any of them on the strength of one page's replay.

**Let the replay have the machine to itself.** Backgrounding it and carrying on with
`npm run check` or `pa11y-ci` is the obvious move and it produces false failures: measured
2026-08-19, the same commit replayed 41/41 in 158s alone, and reported `packages-kept-back` and
`release-channels` as failing when run alongside a build and a headless-browser pass that stretched
it to 413s. Both of those pages stand up a local apt repository and wait for it, which is what
gives under load. A replay that says a true page is lying is worse than a slow one, and it is the one
result on this project nobody can afford to start discounting.

The replay needs Docker and is much the slower of the two, which is why it is a separate CI job
and not part of `check`. A green `check` says the generator works; only the replay says the pages
are true.

## 2. Write the commit message this repo writes

Read `git log` before writing one. The convention here is a short subject, then prose that says
**what was found, not just what changed**: the failure mode, why the fix is the right one, what
was verified and how. A bump in the count of passing examples is not a commit message.

If the change was prompted by something breaking, say what broke and how it was proven fixed.
If a claim was checked in the sandbox, say so. If something was left undone, say that too.

A message written that way is several paragraphs of prose that GitHub publishes beside the code,
so `.claude/reference/voice.md` applies to it. The closer is the one to watch, since a commit
message invites a final sentence that restates the change as a lesson.

End with the trailer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 3. Push, and don't wait for CI

`main` is the working branch here and pushing to it directly is normal for this project.

```sh
git push origin main
```

**Then stop.** Do not poll for the run to finish. The gates in §1 are the same ones CI runs, so
a green local gate has already told you what CI is going to say, and the user watches CI and
reports anything that goes red. Waiting adds minutes per change and finds nothing new.

This is a standing instruction from the user (2026-08-18), not an optimisation to re-derive.

Report what you ran locally and what it said, and move on. If the user later reports a CI
failure, §5 is how to look into it.

There is nothing worth caching to make waiting cheaper; this was checked on run 32179804758.
`check` finishes in 48s. The `replay` shards are about 64s of replay each against a 22s image
build, so image caching is now worth a larger share of that job than it was, and is the next
lever if it matters. npm is already cached by `setup-node`. The log separates image-build time
from replay time on purpose, so it will say which half to fix.

CI runs `check` and four `replay` shards in parallel, split so a failure says which kind it is:
"the generator is broken" and "a page is lying" want different people looking at them. A red
shard names the pages it ran, and `npm run replay -- <page>` reproduces any of them exactly:
which shard a page landed in never changes its result, only when it ran.

## 4. Deploy is gated on CI

`deploy.yml` triggers on `workflow_run` of CI, pinned to the same `head_sha`. So:

- CI green → Deploy runs → the change is live
- CI red → Deploy shows **skipped**, not failed. That is the gate working. Do not report it as a
  second failure.

Per §3, don't wait for this either, because the user watches it. The above is worth knowing for when
they report something, not something to go and check.

If the user does ask whether something reached the site, this is the check that answers it
rather than trusting the workflow's conclusion:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://debian.tips/<path>/
```

Deploy occasionally logs `Back off … before retry` or a 503 fetching an action from GitHub's CDN
and then succeeds. Check the conclusion, not the annotations.

## 5. When CI fails

```sh
gh run view <run-id> --job <job-id> --log-failed
```

The replay names the first line that differs and the mode it ran in. Every CI-only failure this
repo has had was environmental, and the same five causes keep coming back:

- **architecture**: `arm64` locally, `amd64` on the runner. No page may print one.
- **umask**: a `docker exec` inherits the *host's* umask, 0000 here and 0022 on a runner. The
  replay pins 0022; a bare `scripts/sandbox.sh exec` does not.
- **IPv6**: a runner often has it disabled, so anything bound to `::1` fails. Use `127.0.0.1`.
- **directory order**: `find`, `grep -r` and globs follow readdir order. Needs an explicit
  `sort`.
- **races**: `systemctl start` returns before a `Type=simple` service is ready; journald writes
  asynchronously. A page that passes locally three times can still be racing.
- **the page's own earlier examples**: an example installs a package or writes to `/etc`, and a
  later one on the same page reports it. The restore between examples empties the working
  directory and re-runs the setup script; it undoes nothing either of them did elsewhere. The fix
  belongs in that setup script, which should assert the state its output depends on, including the
  *absence* of something.

Fix the cause rather than re-running the job. If the real output is right and the page is wrong,
`scripts/adopt-real-output.ts` re-captures it.
