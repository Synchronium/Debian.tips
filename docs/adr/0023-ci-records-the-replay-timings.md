# ADR-0023: CI records the replay timings

- **Status:** Accepted
- **Recorded:** 2026-08-27
- **Enforced by:** `.github/workflows/record-timings.yml`;
  `scripts/merge-timings.ts`, which refuses to write a file that does not cover every page;
  `test/replayTimings.test.ts`, which fails when too many pages have no recorded time;
  `scripts/check-shard-count.ts` (`npm run shards`), run by that workflow, which reports when the
  shard count no longer suits the recorded timings

## Context

`scripts/replay-timings.json` records how long each page took on the last full replay. Two things
read it: the shard partition, which uses it to balance the CI runners, and the build, which uses
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
- It writes only on a material change: a page added or removed, or a page whose time moved by
  more than the balancer already tolerates not knowing, and by a fifth of itself if it is heavy
  enough for that to be the higher bar. Runner times vary by tens of seconds on the heaviest pages
  between runs of identical content, so without a bar the file is rewritten on every push for
  figures nothing could act on.
- The push uses the default `GITHUB_TOKEN`. Pushes made with it start no workflow run, so there
  is no loop. `[skip ci]` in the message is a second line of defence for the day someone swaps
  the token.
- `npm run replay -- --record-timings` stays, for recording by hand.

**And the figures leave the comment.** The curve is computed from the recorded timings, in
`scripts/lib/replayShard.ts`, and `npm run shards` reports whether the count `ci.yml` runs is still
the one they justify. The workflow states the count and the reasoning; it states no measurement.

**That report is not a test, and the recorder does not wait for it.** The count and the figures are
one decision living in two files, and only the figures have an automatic writer: a workflow may not
write a workflow file, whatever `permissions` it asks for, because the token it is given lacks the
scope. So the figures move on their own and the count cannot.

Both of the obvious ways to hold them together fail, and fail towards the same place.

Making it a test fails a contributor's `npm run check` for a bot commit no CI run ever saw, over a
number they did not touch. Having the recorder refuse to write figures that would fail such a test
wedges the pair: the matrix cannot be changed to a count the committed figures do not yet justify,
and the figures that justify it are exactly what the recorder is refusing to write. Neither half
can move first. The likeliest trigger is the first real recording, since it replaces arm64 figures
with amd64 ones and a single page decides the count.

So the recorder records, always, and `npm run shards` runs afterwards as the last step of the
workflow that did the recording. Red there asks the one person who can act for one line, and blocks
nothing: that workflow gates no deploy, and a count that no longer suits the figures costs wall
clock rather than coverage. It is the same reasoning that keeps the recorder out of `ci.yml`,
applied one level in.

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

**Main gets bot commits, and how often depends on two numbers.** They are small and they name the
commit they measured. The threshold that decides is `max(MOVED_SECONDS, before * MOVED_FRACTION)`,
and the two halves govern different pages: almost everything here replays in seconds and is judged
by the absolute bar alone, while only the few pages heavy enough to decide the shard count ever
reach the fraction.

Both bounds are argued rather than tuned. The absolute bar is `UNTIMED_SECONDS`, what the balancer
already charges a page whose cost it does not know, so drift smaller than that is inside the error
the partition absorbs by design. The fraction is held below the swing that has actually moved the
shard count, since raising it past that would filter out the one measurement most worth having.

Measured over the recordings this has produced, that writes on roughly one push in five. The
narrower pair it replaced wrote on every one, which is what prompted the change: those pages vary
by tens of seconds between runs of identical content, so a bar set for a quiet site reported noise
as news.

**A push during a replay loses that recording.** The bot's push is then a non-fast-forward and is
abandoned rather than retried: the next push measures the site again. A job that fought for main
to deliver an advisory figure would be a worse trade than a figure that is occasionally one run
older.

**Nothing here can fail a build.** The recorder gates nothing and nothing waits for it, so every
way it can go red leaves both the CI badge and the deploy alone. That is what lets it speak up
loudly, which is the behaviour every check in it wants: a hole in the parts, an overlap, a curve
the shard count no longer sits on. A recorder that could turn a green build red would have to be
written to shrug those off instead.

**The shard count can lag the figures, and only a human closes the gap.** The recorder cannot write
`ci.yml`, so between a recording that moves the curve and somebody editing the matrix, CI runs a
count the figures no longer justify. That interval costs wall clock and nothing else, and
`npm run shards` is red for the whole of it, on a workflow whose red nobody has to clear before
shipping. Ignoring it indefinitely is possible, which is the price of not making it a gate.

**Nothing here decides whether a page is replayed.** The file stays advisory in both directions:
stale, the shards balance worse; missing, every page still runs. If that ever stops being true,
this arrangement stops being safe, because CI would then be writing a file that decides what CI
checks.

## Revisit when

Revisit when the threshold stops matching what balance needs and bot commits become noise in
`git log`, which the consequence above says to expect rather than to be surprised by.

Revisit if `npm run shards` starts going red often. Once is the site telling somebody to change
the matrix, which is the arrangement working. Repeatedly means the count is sitting on the
boundary, and the answer there is `WORTH_A_RUNNER` rather than the recording: a threshold that
flips on a second of jitter is asking a question with no stable answer.

Revisit if the matrix is left disagreeing with the figures for long. The report was kept out of
the gates on the grounds that a wrong count costs only wall clock; if it turns out that nobody
acts on a red nothing blocks, that reasoning was wrong about people rather than about builds, and
the answer is a job that opens an issue the way `drift.yml` does.

Revisit if `replay-timings.json` ever gains a reader that is not advisory. A file CI writes must
not become a file that decides what CI checks.
