# ADR-0023: CI records the replay timings

- **Status:** Accepted
- **Recorded:** 2026-08-27
- **Enforced by:** `.github/workflows/record-timings.yml`;
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
- A separate workflow, `record-timings.yml`, merges the parts after a green full run on main and
  pushes the result. Separate rather than a job in CI, because [ADR-0003](0003-ci-topology-and-gated-deploy.md)
  gates deploy on CI's conclusion. A job inside CI could hold back a green build for a reason that
  says nothing about the site, such as an artifact that did not upload or a page added to main
  while the replay ran, and even when green it would add its own checkout and install to the time
  between a push and the site being live. Out here it runs beside the deploy rather than before
  it, and a failure is a red mark on a workflow that gates nothing.
- `scripts/merge-timings.ts` refuses to write unless the parts cover every page that opts into the
  replay, which is the completeness rule `--record-timings` already enforced for a serial run.
- It writes only on a material change: a page added or removed, or a page that moved by two
  seconds, and by a fifth of itself if it is one of the heavy ones. Runner times jitter, and
  without a bar the file would be rewritten on every push for figures nothing could act on.
- The push uses the default `GITHUB_TOKEN`. Pushes made with it start no workflow run, so there
  is no loop. `[skip ci]` in the message is a second line of defence for the day someone swaps
  the token.
- `npm run replay -- --record-timings` stays, for recording by hand.

**And the figures leave the comment.** `test/replayShard.test.ts` computes the curve from the
recorded timings and holds the shard count to it, failing on either side of the right answer and
printing what the count should be. The workflow states the count and the reasoning; it states no
measurement. That is the change that makes the automation safe rather than merely convenient.

**Which means the recorder must not write figures that fail that test.** The two halves are one
decision and CI can only change one of them. A recording that moved the curve would be committed
without a run, because the push is made with `GITHUB_TOKEN`, and would then go red on the next
contributor's `npm run check` for a change that was not theirs. So `merge-timings.ts` asks what
count a candidate file would justify and refuses when that is not the count `ci.yml` runs, naming
the number a human has to change first. The curve is computed once, in `scripts/lib/replayShard.ts`,
so the test and the recorder cannot hold different opinions about it.

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

**Main gets bot commits, and not rarely.** They are small and they name the commit they measured,
but the threshold is a weaker filter than it looks. Most pages on this site are quick, and for a
page below the floor the two-second bar is the only one that applies, since a fifth of a
second-long page is already met by anything that clears two seconds. One page of the majority
having a slow container start is enough to earn a commit, and it only takes one. Whether that is
noise in `git log` is the thing to watch; the alternative is a bar high enough to ignore a page
that really did double, and the figures are only worth having if they track.

**A push during a replay loses that recording.** The bot's push is then a non-fast-forward and is
abandoned rather than retried: the next push measures the site again. A job that fought for main
to deliver an advisory figure would be a worse trade than a figure that is occasionally one run
older.

**Nothing here can fail a build.** The recorder gates nothing and nothing waits for it, so every
way it can go red leaves both the CI badge and the deploy alone. That is what lets it refuse
loudly, which is the behaviour every check in it wants: a hole in the parts, an overlap, a curve
the shard count no longer sits on. A recorder that could turn a green build red would have to be
written to shrug those off instead.

**Nothing here decides whether a page is replayed.** The file stays advisory in both directions:
stale, the shards balance worse; missing, every page still runs. If that ever stops being true,
this arrangement stops being safe, because CI would then be writing a file that decides what CI
checks.

## Revisit when

Revisit when the threshold stops matching what balance needs and bot commits become noise in
`git log`, which the consequence above says to expect rather than to be surprised by.

Revisit if the recorder starts refusing on the shard curve often. Once is the site telling
somebody to change the matrix, which is the arrangement working. Repeatedly means the count is
sitting on the boundary, and the answer there is `WORTH_A_RUNNER` rather than the recording: a
threshold that flips on a second of jitter is asking a question with no stable answer.

Revisit if `replay-timings.json` ever gains a reader that is not advisory. A file CI writes must
not become a file that decides what CI checks.
