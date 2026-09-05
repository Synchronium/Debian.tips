# ADR-0028: `src/content/` is the shared contract, and the dependency runs one way

- **Status:** Accepted
- **Recorded:** 2026-09-05
- **Enforced by:** `test/moduleBoundary.test.ts`

## Context

This repository looks like two halves. `src/` is the generator: it reads `content/`, renders it and
writes `dist/`. `scripts/` is the verification harness: it puts a page in a container and checks
that the output the page claims is the output the command prints. `CLAUDE.md` routes questions to
one or the other, and `.claude/reference/` has a document for each.

The two halves are not independent, because they have to agree about the content. Four questions
have an answer that both need, and a wrong answer is a page that lies:

- **What may a page contain?** The generator validates it; the harness reads the same files.
- **Which examples are exempt from the replay?** The harness refuses a stale entry and skips the
  rest; the generator counts them into the sentence at the foot of the page and the totals on
  `/about/`.
- **Which of a prose page's fences are a command and its output?** The harness runs them; the
  generator counts them.
- **How long did each page take?** The harness balances its shards with it; the generator tells a
  reader how long re-running the page will take.

Each of those was, at some point, answered twice. `scripts/replay-timings.json` and
`test/verification-baseline.json` disagreed about how to key a page for as long as both existed.
The headers on `src/content/replaySkips.ts` and `src/content/replayTimings.ts` both say what that
cost: *"two readers of one file is how two readers disagree."*

The arrangement that fixed it was never written down. It survives as one comment, three levels deep
in the harness, in `scripts/lib/replayShard.ts`:

```ts
// The build needs the same figures, to tell a reader how long re-running a page takes,
// and `src/` cannot import from `scripts/`.
```

That is a real rule, and it decides the shape of two directories: it is why the recorded timings
live under `scripts/` but are read through `src/content/replayTimings.ts`, and why `replayShard.ts`
re-exports `readTimings` rather than letting anything in `src/` reach into `scripts/` for it. But
nothing stated it, nothing enforced it, and nothing explained to someone opening `src/content/` why
a directory named for the content holds four modules about replaying it.

## Decision

**`src/content/` holds the contract the generator and the harness share. `scripts/` imports from
`src/`; `src/` never imports from `scripts/`.**

A module both halves need lives in `src/content/`, whichever half runs it more often. Today that is
`schema.ts` (what a page may contain), `pageChecks.ts` (the partition into checked and exempt),
`proseBlocks.ts` (the fence-pairing rule), `replaySkips.ts` (the exemption list) and
`replayTimings.ts` (the recorded seconds). `loader.ts` is there for the same reason: the link audit
and the verification baseline both load the real content model rather than walking `content/` again.

A module only the harness needs stays in `scripts/lib/`. The test is not who calls it more, but
whether the **build** needs the same answer. `scripts/lib/normalise.ts` decides what counts as a
match between two runs, which the build has no opinion about, so it stays in the harness even
though more of the harness depends on it than on anything else.

The direction is what makes this work rather than the location. The generator has to run in CI's
`check` job, in the dev server and on a machine with no Docker, so it cannot depend on a harness
that shells out to containers. Pointing the dependency the other way would mean either duplicating
these five modules or making the build require the harness.

## Consequences

`src/content/` holds modules the build barely exercises, and that is the intended state rather than
drift. `replayTimings.ts` exists so the build can print "and takes about 30 seconds" at the foot of
a page; almost everything else that reads it is in `scripts/`. Anyone tidying `src/content/` by
moving those files into the harness would break the build, and `test/moduleBoundary.test.ts` is
what tells them so.

`scripts/` carries 35 imports from `src/`, and that number should be expected to grow. It is not a
layering violation; it is this decision working.

The cost is that a reader has to know the rule before `src/content/` reads as coherent. This record
and the paragraph in `.claude/reference/architecture.md` are the whole of the remedy.

## Revisit when

Something in `src/` genuinely needs an answer only the harness can give. Today nothing does: every
figure the build states about verification is counted from files that are checked into the
repository, never from a run. If that changed, say for a template wanting the *result* of the last
replay rather than its duration, the fix is to have the harness write a file and the build read it,
which
is the arrangement `replay-timings.json` already demonstrates, rather than to reverse the import
direction.
