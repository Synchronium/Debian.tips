# ADR-0026: A comparison that ignores line order

- **Status:** Accepted
- **Recorded:** 2026-09-02
- **Enforced by:** `src/content/schema.ts`, which refuses an example setting `unordered:` without a
  `volatile:` note, and a fixture block setting it without a `note:`;
  `scripts/lib/verificationBaseline.ts`, whose `exact` figure subtracts it, so
  `test/verificationBaseline.test.ts` fails when an example moves from exact to unordered without
  the snapshot recording it; `test/normalise.test.ts` and `test/schema.test.ts`

## Context

The `ss` page was written, replayed 53/53, merged, and failed CI on the shard that ran it. Twelve
examples and the fixture block differed on the same thing: the page printed `0.0.0.0:8080` above
`127.0.0.1:5432` and the runner printed them the other way round.

Six fresh containers on one machine split three each way. `ss` lists sockets in the order it walked
the kernel's own tables, that order is settled per network namespace, and
[ADR-0020](0020-one-container-per-page.md) gives every page a namespace of its own. Starting the two
listeners serially, waiting for each to appear before starting the next, gives the same answer eight
times out of eight inside one container, and `tips-api` binds first yet lists second, so it is not
the bind order and no setup script can pin it. `ss` has no flag that sorts.

The page had passed locally because the coin landed the way it had when the output was captured.
One container serves a whole page, so every example agreed with every other and the page read as
internally consistent whichever way it fell.

Three fixes were available before this one, and each was worse.

**Pipe through `sort`.** This works for the examples that already pass `-H` and not for the rest.
Every column header sorts after the data beneath it, so `ss -ltn | sort` prints its own header
last, and `ss -ltn` is the form most readers arrive wanting.

**Thin the fixture to one TCP listener.** The filtering section is built on there being two, and
most of its examples select one of them.

**Mark them `compare: shape`.** This would have passed, which is why it is recorded here rather
than left out. `shapeOf` masks digit runs, so `0.0.0.0:8080` and `127.0.0.1:5432` reduce to the
same token and a swapped order compares equal. Two examples on the page were already passing that
way. The comparison it leaves behind is empty: any two listening rows match, and if one of them
ever gained a hex letter the example would start failing for a reason nobody would trace back
here.

There is a precedent against relaxing the comparison at all. Commit `cd083e4` fixed eight examples
whose order came from readdir by sorting in the command, and rejected sorting during comparison on
the grounds that it "would hide the difference while still showing readers an order they may not
get". That reasoning stands, and it is why `unordered:` requires `volatile:`: the reader is told
which part of the output not to rely on, in the same line that already tells them about a PID. The
difference here is that `find` can be handed a `sort` and `ss` cannot.

## Decision

**An example may declare that the order of the lines it prints is not part of its claim.** The
lines are compared as a multiset: each must appear as many times as the page shows it, and a
vanished line, an extra one or a changed one fails as before.

`unordered:` is a separate axis from `compare:`, not a fourth mode of it, because the two compose.
`ss -ltnp` prints a PID no anchored mask covers and prints its rows in an order the kernel picks,
so it needs both. Lines are reduced by `normalise` or `shapeOf` first, then sorted.

It requires `volatile:` for the reason `compare: shape` does. The reader is looking at an order
nobody promises to reproduce, and should be told rather than left to assume the page checked it.

**Where a `sort` would do, the `sort` is written instead.** `find`, `grep -r` and glob expansion
follow directory order, `awk` array iteration is unspecified, and `xargs -P` interleaves by which
child finishes first. Every one of those pages already pipes through `sort`, and should: it holds
the page to a stronger claim, and a reader writing a script needs the `sort` anyway. That leaves
the case this is for, an order nothing in the pipeline can be asked for.

The figures a page states about itself gain a third clause, so `ss` reads "Checks 53 outputs: 27
exactly, 16 by shape and 10 in any order". An example that is both shape-compared and unordered is
counted under shape, so the three partition the total and the sentence adds up. The overlap goes to
the looser of the two, since rounding the other way would let a page claim a strictness it is not
held to.

## Consequences

A header sorts in with the rows, so an output that printed one in the middle would still match.
Pinning the first line instead would be a guess about which outputs have a header, and `ss -ltnH`
is one that does not.

**Nothing mechanical stops `unordered:` being used where a `sort` would have done.** The
requirement for `volatile:` makes the choice visible to a reader and to review, and the baseline
snapshot makes it visible in a diff, but neither can tell whether the order was really outside the
command's control. This is a rule held up by the schema comment and by whoever is reading.

Prose pages have no way to spell it. `COMPARISON` is shared between the `compare:` field and the
`<!-- verify: -->` directive, and this is not a member of it, so the directive parser is unchanged
and `proseChecks` reports zero. No prose page has needed one.

`exact` in the verification baseline now subtracts both relaxations. Without that, moving an
example from exact to unordered would register as no change at all, which is the edit the snapshot
exists to catch.

The `ss` page came back at 53/53 across six consecutive runs. Swapping the two rows on the page and
replaying passed as well, so the flag is doing the work rather than the container having matched by
luck. Swapping two lines on an example that is not marked failed, so order is still checked
everywhere else.

## Revisit when

Revisit if a second page needs this. One page is thin evidence for the shape of a mechanism, and a
second would say whether a multiset comparison is right or whether a per-example sort key was what
the problem wanted.

Revisit if a prose page needs it, which means extending the `verify:` directive rather than reusing
this field. The directive is built from `COMPARISON` on purpose, so a mode added there is parsed
everywhere, and an axis that is not a mode has to be spelled separately in both places.

Revisit if `unordered:` starts appearing where a `sort` was available. Nothing detects that. It
would look like a page marking a listing it could have piped somewhere.
