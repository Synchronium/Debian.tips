# ADR-0020: Every page is replayed in a container of its own

- **Status:** Accepted, with a deferred follow-up
- **Recorded:** 2026-08-24
- **Supersedes:** [ADR-0002](0002-one-shared-sandbox-serial.md)
- **Enforced by:** `scripts/replay-all.ts`, which starts and stops a sandbox around each page; `scripts/sandbox.sh`; the sharded `replay` job in `.github/workflows/ci.yml`; `test/replayShard.test.ts`, which holds the partition the sharding depends on

## Context

ADR-0002 put every page in one shared sandbox and made that arrangement the contamination test:
there was no separate assertion that pages do not interfere with each other, because running them
all in one container was the assertion. It worked. Seven real defects were caught that way, and
each one is recorded there and in `CLAUDE.md`.

What it could not do is stop the defects arriving. Every page had to be written defensively, and
the defence is invisible in the page and expensive in the fixtures. Counted across the 57 setup
scripts on 2026-08-24:

| Defensive code repeated because the sandbox is shared | Scripts |
| --- | --- |
| The identical `sources.list.d` sweep, verbatim | 8 |
| The identical `preferences.d` wipe, verbatim | 8 |
| Writes an `apt.conf` fragment suppressing apt's CLI warning | 5 |
| Deletes that same fragment | 1 |
| Undoes an `apt-mark` another page set | 4 |

42 lines existed only to undo what another page might have done, and that number grows with the
apt cluster, which is the group with the most pages still unwritten.

The last row of that table is the part that does not scale. Five pages want apt's "not a stable
CLI interface" warning suppressed; `/compare/apt-vs-apt-get/` documents that warning, so it wants
the opposite. Two pages wanted mutually exclusive configuration of the same file, and the shared
sandbox has no answer to that beyond "whichever runs last wins, so make every page undo the
others". `cowsay-off` is the same shape from the other side: one page's output depends on a
package being absent that another page installs. Both were found by a failing batch rather than
by construction, and the backlog contains more of them: `apt-mark` wants holds set that
`packages-kept-back` also sets, and `apt-file` wants a 100MB `Contents` index no other page wants.

The cost of the alternative had never been measured. It turned out to be small.

## Decision

`npm run replay` starts a fresh container for each page, replays that page in it, and tears it
down before the next page starts. Pages still run **serially**, one at a time, so nothing here
trades determinism for speed.

A page's result therefore depends on the sandbox image, on its own setup script, and on nothing
else.

Two things follow, and both are removals rather than additions:

- **`--order` is gone**, along with the ordering module and the test that covered it, both named
  in ADR-0002's "Enforced by". Ordering existed only to sample the space of cross-page
  interactions. With a container per page the order cannot reach any result, so a shuffled run is
  a gate that can never fail, which is worse than no gate: it reads as coverage.
- **The `replay-shuffled` CI job is gone.** Same reason. ADR-0003 is edited rather than
  superseded: its decision was that replay is separate from `check` and that deploy is gated on
  the whole workflow, and both hold whatever the replay is made of, which is why sharding it into
  four later did not disturb them either.

The corollary ADR-0002 recorded still holds and matters more now: **tools the site documents are
installed in the sandbox image, not by the page that documents them.** The image is the only
thing pages now share, so it is the only place a difference between pages can come from.

## Consequences

**A single-page replay is now authoritative.** `npm run replay -- <page>` puts the page in the
same container the full run does, so it reproduces a batch failure exactly. Under ADR-0002 the two
could disagree, and learning to distrust a green single-page run was part of working here.

**Cross-page contamination is impossible rather than tested.** Two pages may now want mutually
exclusive system state and neither has to know the other exists.

**The full replay costs no measurable wall clock**, which was not the expected answer. Measured on
2026-08-24, 56 pages: **265s shared, 266s isolated**. Isolation itself costs about 23 seconds, and
two defects found while measuring it returned about as much:

| | Cost |
| --- | --- |
| Container start | 0.65–0.75s, or 1.3s for a systemd sandbox |
| Container stop | 0.09s |
| `apt-get update`, now paid by each of ~9 apt pages rather than by the first one | 3.2s each |

The first defect: `docker stop` was taking **10.2 seconds** every time, because it sends SIGTERM
and waits out the full grace period, and neither init reacts to SIGTERM (`sleep infinity` has no
handler, systemd wants SIGRTMIN+3). `scripts/sandbox.sh` now stops with `-t 0`: 0.09s.

The second: the image staleness check compared the build context against the image's *creation*
time, and a rebuild that hits the layer cache keeps the cached layer's creation time. So the image
was permanently older than the context that had just rebuilt it, and every call rebuilt. One
container per run made that one wasted check; one per page made it 56, which is how it was found.
The check now compares against a label holding the context's newest mtime.

Both were costing the shared arrangement too, so the fair reading is that isolation is roughly
free rather than that it pays for itself.

Deleting the `replay-shuffled` job returns a whole runner, so total CI machine time for replay
work falls even though the one remaining job is slower.

**Independent pages are shardable pages**, which is the second consequence and is why the
"Revisit when" below was acted on the same day. `--shard=<i>/<n>` splits the run across runners,
and it is sound only because of this record: a shard is a subset, and under the shared sandbox a
subset was a different experiment from the whole, since the pages missing from it were also the
pages that had been contaminating it.

**A container can outlive an interrupted run, so the run sweeps before it starts.** Tearing down
after each page covers the ordinary paths and a handler covers an interrupt between pages, but
neither can cover one that arrives mid-example: the loop is blocked inside a synchronous
`docker exec`, and a JavaScript signal handler cannot run until that returns. Confirmed by
interrupting a run and finding a container still up. The replay therefore names its containers
after itself and the page, and removes any bearing the pid of a process that is no longer running.
A sandbox somebody started by hand to write a page with does not carry that marker and is never
swept. This was true of the shared sandbox too; one container per page makes it likelier to be met
rather than worse when it is.

**The defensive lines are pruned, in a separate commit.** They fell into two classes that look
identical in the file: undoing what *another page* did, which is now dead, and undoing what *an
earlier example on the same page* did, which is still required, because the setup script runs
before every example and the restore only resets the page's working directory. Which one a line
is cannot be read off its text, so each was decided by asking whether the page's own blocks
perform the mutation, and the replay was the check.

Most of the volume turned out to be the second class and stays: the `apt` page really does run
`apt-mark hold cowsay`, `/compare/remove-vs-purge-vs-autoremove/` really does end by marking
cowsay manual, and the three pages that add apt sources in their own blocks really do have to
sweep the directory. What went: eight repetitions of a `sources.list.d` and `preferences.d` sweep
on pages that never touch either, a `nano` purge undoing `apt-essentials`, a `cowsay-off` purge
undoing the `apt` and `dpkg` pages, `bash-completion` and `ca-certificates` guards against state
no page sets any more.

The comments mattered more than the line count. A dozen of them explained a mechanism that no
longer exists, and a page's setup script is linked from the page, so a reader who followed that
link to check whether a claim is really checked was being taught a constraint that had stopped
being true.

**What this does not fix**, and should not be read as fixing:

- **State within a page.** Example 3 installing a package still affects example 10. That is
  visible in the page's own `examples.yaml`, in order, to whoever wrote it.
- **Non-determinism inside a command.** `du` and `find` walk directories in readdir order; that
  is a property of the command, not of the sandbox, and a reader running it sees it too.
- **The architecture constraint.** ADR-0004 stands. Confirmed while writing this that emulation
  cannot close it here: `docker run --platform linux/amd64` on this devcontainer fails with
  `exec format error`, so there is no binfmt handler to fall back on.

## Revisit when

**Taken already, 2026-08-24, ahead of the ten-minute trigger this record originally set.** The
lever named here was parallelising across containers, and it turned out to be cheap enough not to
wait for: pages are independent, so distributing them changes only speed. `npm run replay` grew
`--shard=<i>/<n>`, and CI shards it across runners.

The prediction that the ceiling is one page held exactly. What this record got wrong is the shape
of the risk: it framed parallelising as a change to *what is tested*, which was true of the shared
sandbox and is not true now. The risk that replaced it is a page belonging to no shard, which is a
partition problem rather than a contamination one, and `test/replayShard.test.ts` holds it.

The count moved from four to five and then to seven, both on 2026-08-26, and the second move
corrected a mistake in the first. Five was chosen on the argument that nothing waits on the replay
job, so a runner buying seconds was not worth spending. That is wrong: ADR-0003 gates deploy on
this workflow's conclusion, which makes the slowest shard part of the time between a push and the
site being live. With that understood, the count should sit wherever the curve stops moving.

Where that is, is not written down anywhere any more. It was in a comment beside the matrix, and
[ADR-0023](0023-ci-records-the-replay-timings.md) moved it into `scripts/lib/replayShard.ts`, which
computes the curve from the recorded timings. `npm run shards` prints it and says which count it
justifies. So the workflow states a count and no measurements, this record states the argument and
no measurements, and the number is computed rather than remembered. Changing it is still one line
in `.github/workflows/ci.yml`, and the report says which line and what to.

Revisit when the slowest single page dominates the shard budget rather than merely setting it,
which the current count already does: the slowest shard is within seconds of the `apt` page on its
own. From here more runners buy almost nothing, and the lever is that page's setup script.

Also revisit if the per-page `apt-get update` grows beyond a few seconds. Baking the package lists
into the image was considered and rejected: the lists would be as old as the last image build,
Debian's archive drops superseded `.deb` files, and an install inside an example would start
failing with a 404 that looks exactly like a page that has drifted.
