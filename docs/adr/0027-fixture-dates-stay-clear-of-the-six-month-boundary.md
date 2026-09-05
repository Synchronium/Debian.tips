# ADR-0027: Fixture dates stay clear of the six-month boundary

- **Status:** Accepted
- **Recorded:** 2026-09-05
- **Enforced by:** `test/timestampDrift.test.ts`, which reads every fixed date a setup script or an
  example stamps on a file and fails while one is within a month of the boundary

## Context

`ls -l` prints a time of day for a file modified within the last six months, and the year instead
for anything older. Coreutils draws that line at half a Gregorian year, and a file more than an hour
in the future gets the year form too.

Every listing on this site takes its timestamps from a `touch -d` in a setup script, and those dates
are literals. So each one crosses the boundary on a day that can be worked out in advance, and takes
every page showing it on the same day. The dates in `scripts/fixtures/_common.sh` go first: a file
stamped 1 June 2026 stops printing `Jun  1 09:00` and starts printing `Jun  1  2026` on about
1 December 2026. On 2026-09-05 the form appears on 283 lines across 16 pages, and all but a handful
of those lines take their date from a setup script rather than from the clock at capture time.

Nothing would have reported it before the day itself. The exact comparison sees a different string.
`compare: shape` looks like the answer and is not: `shapeOf` masks the month name and every digit
run, but not the colon between the hours and the minutes, so `M 0 0:0` and `M 0 0` still differ.
That left the replay as the only signal, and the replay reports on the day the pages start lying
rather than before it. Sixteen pages would have gone red together, on a date nobody had written
down, for a reason whose cause was six months upstream of its effect.

Three other fixes were available.

**Let the replay carry it.** It does catch the breakage, and one morning's worth of red shards is
not fatal. What makes this the wrong answer is the diagnosis rather than the repair: a batch of
unrelated pages failing at once on timestamps nobody has touched reads as a harness fault, and the
harness is the thing that has to stay trustworthy.

**Stamp the fixtures with dates that are already past the boundary.** This ends the problem
permanently: a listing showing a year keeps showing that year, so the dates never need attention
again. It was rejected on how the site reads. The trees these fixtures build are logs, backups and
source files, and a page teaching `ls -lt` or `find -mtime` against a directory whose every entry is
dated last year is teaching it against something nobody's machine looks like.

**Compute the dates at replay time**, as `scripts/fixtures/file-permissions-explained.sh` does with
`touch -d "$(date -d '3 days ago' …)"`. A file that is always three days old never drifts. The cost
is that the page can no longer state what the listing says: that block carries
`<!-- verify: shape … -->` and must, because the date it prints is different on every run. Applied
across the site this would move hundreds of exactly-compared lines onto the loose comparison, which
is a real weakening of the claim to fix a scheduling problem.

## Decision

**A fixed date that a page displays sits well inside the six-month window, or well past it, and
never near the edge.** A test fails while any such date is within a month of the boundary, which
puts the failure roughly a month before the pages break, and holds it there through the month after
rather than going quiet again while they are wrong.

**Dates stay current.** When the test fires, the fixtures are re-dated forward and the affected
output is re-captured, so the listings keep showing recent work. The alternative of retiring a date
into the year form is available for a fixture whose page wants an old file, and
`_common.sh` already keeps one: `site-2026-01-01.tar.gz` is stamped in 2025 because it is the
`-mtime +365` match that several pages select on, and it is the one line on the site that shows the
year form on purpose.

The test reads both setup scripts and example code, since an example may stamp its own date. An
example's dates are read only when its output shows a listed time of day, because that is the only
form the boundary reaches: an example that stamps a date and reads it back with `stat` or `find`
prints the whole date or none, and is free to choose any. Dates built by substitution are skipped,
being the same age on every run.

## Consequences

**This is a recurring chore, roughly twice a year**, and that is the price of the listings looking
current. What to do when the test fails:

1. **Choose the new dates by shifting the whole set forward**, keeping the gaps between them. The
   pages depend on which file is newer than which, not on any particular date: `find -newer`,
   `ls -t`, `cp -u` and `sort` on the timestamp all read the order, and `_common.sh` says in a
   comment which file is the reference. Leave the deliberately old one where it is.
2. **Re-capture each affected command page** against a sandbox holding the new fixtures:
   `npx tsx scripts/adopt-real-output.ts [--user] <sandbox> <command> scripts/fixtures/<command>.sh --all`.
   The tool reads the page's own `# verify:` line, so the flag is needed only for a page whose
   script does not declare one; capturing as root against a page that replays as `user` bakes
   `root root` into every listing on it.
3. **Re-capture the `fixtures:` blocks and the prose pages by hand.** `adopt-real-output.ts` rewrites
   `output:` blocks on command pages and nothing else, so a captured `ls -lAR` tree and a prose
   page's output fence are re-run in the sandbox and pasted. Each fixture block's `from:` field is
   the command that reproduces it.
4. **Replay everything**, since a change to `_common.sh` reaches every page, then `npm run check`.

**A new fixture may not pick a date in the band.** The margin is a month either side, so the range
it forbids is the one where a captured listing would be true only briefly. The rule costs nothing
real and the failure names the file and the line.

**The scan is pattern matching against shell**, so a form it does not recognise is a date it does
not check. It reads `touch -d` and the full `YYYYMMDDhhmm` form of `touch -t`, and it anchors on the
digits rather than on whatever follows `-t`, because `xargs -t` shares a line with `touch` on the
`xargs` page and a looser pattern reads `rm` as a timestamp. A floor on how many dates the setup
scripts yield is what stops a broken pattern passing over an empty list.

The band was verified against a fixed clock rather than only against today, since a check that
passes on the day it is written has not shown that it can fail. One date is read on four days and
asserted to pass, fail early, keep failing, and settle.

## Revisit when

Revisit if the chore lands more often than the calendar predicts, or if a re-capture turns out to
churn more than the timestamps. Both would say the fixtures are carrying more of the date than they
need to, and the answer would be fewer distinct dates rather than a different rule.

Revisit if a page needs a listing whose file is genuinely recent to the reader, which no page
currently does. That wants the computed date and the shape comparison it forces, and the trade is
worth making one page at a time rather than as a policy.

Revisit if `ls` stops being the only command whose output changes form with age. The rule is written
around one boundary in one program; a second would make it a general problem about output that is a
function of the clock, which is a different mechanism from a test that reads dates out of shell.
