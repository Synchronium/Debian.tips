# ADR-0005: Output that cannot reproduce exactly is declared, never quietly excused

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `scripts/lib/normalise.ts` and `test/normalise.test.ts`, `scripts/replay/command-page.ts`, `scripts/replay/prose-page.ts`

## Context

Some genuinely useful output cannot repeat byte for byte. `systemctl status` carries a PID, an
uptime and an invocation id. `df -h` reports the reader's own disks. `wget` prints a transfer rate.

Three responses are available and two of them are bad. Dropping the example loses the most useful
thing on the page. Faking the output breaks the promise the whole site rests on (ADR-0001). Only
the third keeps both: say exactly what will differ, and check everything else.

The same problem in a harder form: a few examples cannot be replayed by a batch at all, because
they need a concurrent writer (`tail -f`) or a network peer. Left alone they fail forever, and the
temptation is to make the failure go away rather than to explain it.

## Decision

Two mechanisms, and both are explicit and visible.

**`volatile:`** carries a note saying what will differ. The note is rendered to the reader above
the output ("Your output will differ: …"), so they can tell an expected difference from a broken
command. The replay compares that example by *shape*: quantities and their units, weekday and
month names, long hex identifiers, digits and column padding are masked on both sides, so the
numbers may move while a renamed field, a vanished line or a changed state still fails.

**`scripts/fixtures/<slug>.skip`** lists, by exact title, examples a batch cannot replay, each with
a comment saying how it *was* verified. For prose pages the equivalent is a
`<!-- verify: skip <reason> -->` comment, and a skip with no reason is refused.

Scores report the two kinds separately (`53/53 documented outputs reproduce (52 exactly, 1 by
shape)`) because they are different claims.

## Consequences

`volatile:` is for output that varies, not for output a reader could never see. A container id or a
path from the harness has to be removed, not declared. This is the line that keeps the mechanism
from becoming a way to make any failure stop.

A `.skip` entry must name a real example that documents an `output:` block. An entry matching
nothing is an error, because a renamed title would otherwise leave the file claiming an exemption
it no longer grants, reading as an exemption while exempting nothing.

A documented output may never contain a mask token (`<TIMESTAMP>`, `<RATE>`, `<VOLATILE>`,
`<ELAPSED>`). The masks are idempotent, so a page carrying one would match any real output forever.
The replay rejects that outright.

`normalise.ts` is on both sides of every comparison, since adopt writes through it and verify
compares through it, so a bug in it corrupts a page and then certifies the corruption. That is why
every mask is anchored to the line shape that produces it rather than applied to the whole output, why it
has its own test file, and why a change to it means replaying everything rather than one page.

## Revisit when

The shape comparison starts passing something it should have caught. The masks are deliberately
narrow for that reason; widening one is a decision to check less, and belongs in the test alongside
the change.
