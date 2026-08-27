# Plans

What to build next, and why. A plan is expected to be wrong in places, and to be rewritten as the
work it describes gets done.

## How a plan gets here

A plan starts as a personal note, outside this repository, and is promoted here when it becomes
worth other people reading. Promotion is deliberate rather than automatic, because a note nobody
else reads can stay rough and a file in `docs/` cannot.

Promoting one requires a pass over its prose against `.claude/reference/voice.md`: everything under
`docs/` is published prose, and the voice checker walks this directory. Both plans promoted on
2026-08-24 needed that pass; between them they carried 231 em dashes.

A promoted plan also comes under `test/documentedPaths.test.ts`, which checks that every
repository path it names still exists. That found a stale one on the first run.

## How a plan differs from an ADR

`docs/adr/` records decisions that have been taken. A plan holds the thinking that has not
resolved into one yet.

When a plan does resolve into a decision, the decision goes to `docs/adr/` and the plan keeps
whatever remains open. Someone wanting to know why the repository is the way it is should find
the answer in an ADR rather than inferring it from a backlog.

## The plans

- `PLAN-CONTENT.md`: what to write on the site, in what order, and the evidence for that order.
- `PLAN-DEBIAN-VERSIONS.md`: what to do about Debian releases, measured rather than assumed.

Each carries its own revision note, and every figure in them is counted from the repository on
the date beside it rather than copied from an earlier draft.
