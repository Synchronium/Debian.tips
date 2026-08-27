# ADR-0023: CI records the replay timings

- **Status:** Accepted
- **Recorded:** 2026-08-27
- **Enforced by:** the `record-timings` job in `.github/workflows/ci.yml`;
  `scripts/merge-timings.ts`, which refuses to write a file that does not cover every page;
  `test/replayTimings.test.ts`, which fails when too many pages have no recorded time;
  `test/replayShard.test.ts`, which holds the shard count to what the timings justify

## Context

`scripts/replay-timings.json` records how long each page took on the last full replay. Two things
read it: the shard partition, which uses it to balance seven CI runners, and the build, which uses
it to tell a reader roughly how long re-running a page will take.

It was written by `npm run replay -- --record-timings`, a full serial replay on a maintainer's
machine. That is eight minutes of a laptop doing nothing else, it has to be remembered, and
`test/replayTimings.test.ts` allows only three pages to go untimed before it fails, so the
remembering falls due every few pages.

Three things were wrong with that arrangement beyond the waiting.

**The data already existed.** A push to main replays every page across its shards. Every page is
timed on every push, and every one of those measurements was discarded when the runners
were torn down. The manual recording was re-measuring, serially, what CI had just measured in
parallel.

**It was measured on the wrong machine.** The figures balance amd64 runners. They were being taken from
whichever machine ran the recording, which for this project is an arm64 devcontainer.

**A comment restated the data.** The workflow carried a table of slowest-shard times at four shard
counts, to justify choosing seven. That table is `shardPages` evaluated over
`replay-timings.json`, written out by hand. Nothing checked it, so it aged every time a page was
added, and it was found stale only when somebody happened to recompute it. It is exactly the
comment CLAUDE.md rules out: a measurement that will move.

The third is what kept the first two: any automatic recording would silently age that table, so
the recording had to stay manual to keep a human beside it.

## Decision

**CI records the timings, from the run it already performs, and commits them to main.**

- Each `replay` shard writes what it measured with `--timings-out`, as an artifact. No shard may
  write `replay-timings.json`: each holds a fraction of the site, and a partial write would drop
  every page it did not run.
- A `record-timings` job merges the parts after a green full run on main, and pushes the result.
- `scripts/merge-timings.ts` refuses to write unless the parts cover every page that opts into the
  replay, which is the completeness rule `--record-timings` already enforced for a serial run.
- It writes only on a material change: a page added or removed, or a page that moved by both 20%
  and two seconds. Runner times jitter, and without a threshold the file would churn on every
  push.
- The push uses the default `GITHUB_TOKEN`. Pushes made with it start no workflow run, so there
  is no loop. `[skip ci]` in the message is a second line of defence for the day someone swaps
  the token.
- `npm run replay -- --record-timings` stays, for recording by hand.

**And the figures leave the comment.** `test/replayShard.test.ts` computes the curve from the
recorded timings and holds the shard count to it, failing on either side of the right answer and
printing what the count should be. The workflow states the count and the reasoning; it states no
measurement. That is the change that makes the automation safe rather than merely convenient.

The timings are keyed `category/slug`, as `test/verification-baseline.json` is. They were keyed by
bare slug, which is how the replay names a page but not how anything is stored here.

## Consequences

**Nobody waits for a timing run.** Adding pages no longer accrues a debt that falls due as a red
test every third page.

**The figures describe the machine they balance.** They are measured on the runners the partition
is for, which the manual recording never was.

**A committed figure can be one push behind on the site.** Deploy triggers on CI's conclusion, and
the timing commit does not start CI, so a new figure reaches the site with the next real push. The
figure is an estimate a reader is given before running a command, so a push of lag costs nothing.

**Main gets bot commits.** They are small, they name the commit they measured, and the threshold
keeps them rare. Anyone reading `git log` for content changes will see them.

**A push during a replay loses that recording.** The bot's push is then a non-fast-forward and is
abandoned rather than retried: the next push measures the site again. A job that fought for main
to deliver an advisory figure would be a worse trade than a figure that is occasionally one run
older.

**Nothing here decides whether a page is replayed.** The file stays advisory in both directions:
stale, the shards balance worse; missing, every page still runs. If that ever stops being true,
this arrangement stops being safe, because CI would then be writing a file that decides what CI
checks.

## Revisit when

Revisit when the threshold stops matching what balance needs: either bot commits become frequent
enough to be noise in the log, or the shard test starts failing on a curve the recorded figures
were too slow to reflect.

Revisit if `replay-timings.json` ever gains a reader that is not advisory. A file CI writes must
not become a file that decides what CI checks.
