---
title: "awk"
tagline: "Split lines into fields and compute over them"
description: "Tested awk examples: fields and records, patterns, BEGIN/END, arrays, printf, and practical one-liners."
category: commands
tags: [text-processing, regex]
updated: 2026-08-12
tier: flagship
related: [grep, sed, pipes-and-redirection, sort, uniq]
---

`awk` reads its input one record at a time (a line, by default), splits each record into
**fields**, and runs a small program against them. Where [`grep`](/commands/grep/) answers "which
lines match?" and [`sed`](/commands/sed/) answers "how do I transform matching lines?", `awk`
answers "how do I pull *fields* out of a line and compute something with them?" You want it
once a task stops being about lines and starts being about columns: totals,
averages, tallies, reordering, reformatting. It is not the tool for JSON, which has no columns
and no fixed idea of where its lines go: [`jq`](/commands/jq/) is the equivalent there.

## Every program is a list of `pattern { action }` pairs

An `awk` program is a series of `pattern { action }` pairs. For every input record, `awk` tests
each pattern in order; if a pattern matches (or there is no pattern, meaning "always"), it runs
the associated action. Leave off the action and the default is `{ print }`, so `awk '/error/'
file` is a complete, working program: print every line matching `/error/`. This is why so many
`awk` one-liners look shorter than the equivalent `grep`/`sed` combination once you know the
shorthand.

```bash
awk '/error/' app.log          # pattern only: same job as grep
awk '{ print $1 }' app.log     # action only: same job as cut
awk '/error/ { print $1 }' app.log   # both: grep + cut in one pass
```

## How awk splits a record into fields

Each input line is a **record**, split on whitespace by default into **fields**: `$1` is the
first field, `$2` the second, and so on, `$0` is the whole record, and `$NF` is always the last
field regardless of how many fields a line has. `NF` (number of fields) and `NR` (number of
records seen so far, i.e. the line number) are built-in variables updated automatically for every
record. Because field splitting is automatic, tasks that need `cut -f2 | ...` in one tool often
need nothing more than `{ print $2 }` in `awk`.

The default field separator (`FS`) is "any run of whitespace," which quietly handles both
single spaces and columns padded with extra spaces. Set a different one with `-F` (or `FS=` in a
`BEGIN` block) for structured data: `-F: `for `/etc/passwd`-style files, `-F,` for CSV, or a
regex like `-F'[0-9]+'` when the separator itself varies. `OFS` (output field separator, a single
space by default) controls how fields are rejoined when you print them individually or rebuild
`$0` by reassigning a field.

## BEGIN and END: code that runs once

Most of an `awk` program runs once per record, but `BEGIN { ... }` runs once before any input is
read (good for setting `FS`/`OFS` or printing a header) and `END { ... }` runs once after the
last record (good for printing totals). A running total accumulated in a plain variable across
every record, then printed in `END`, is `awk`'s signature move:

```bash
awk -F, 'NR > 1 { sum += $3 } END { print sum }' employees.csv
```

`END` runs even if `BEGIN` set things up but no records ever arrived, and any variable you never
explicitly initialise starts as both `0` and `""`, so `sum += $3` works from the very first line
without a `sum = 0` line first.

## Variables, arrays, and control flow

`awk` variables need no declaration and no type: assign a string or a number, and later use the
same variable as the other, and `awk` converts as needed. Arrays are **associative** (keyed by
string, not just integer index), which makes them the natural structure for counting and
grouping: `count[$1]++` builds a frequency table of field 1 across every record in a single pass,
no external [`sort | uniq -c`](/commands/uniq/) needed. `awk` also has the `if`/`else`, `for`, and `while` you'd
expect from a general-purpose language, plus a ternary `?:`, so logic that would need a `sed`
hold-space trick or a shell loop around `grep` often fits in one `awk` line instead.

## print vs printf

`print` is the quick option: it writes its arguments joined by `OFS` and terminated by `ORS`
(a newline, by default), with sensible defaults for both. `printf` gives up those defaults in
exchange for control: field widths, decimal places, zero-padding, no trailing newline unless you
write `\n` yourself. Use `printf` the moment output needs to line up in columns or a number
needs a fixed number of decimal places.

## Debian's awk is mawk, not gawk

Debian's `awk` is a symlink managed by `update-alternatives`, and on a fresh install it usually
points at `mawk`, a smaller and faster implementation that covers the POSIX language well
(everything on this page runs under it).
[`apt install gawk`](/debian/apt-essentials/) pulls in the GNU implementation,
which adds extensions such as `gensub()`, `asort()`, and in-place editing (`-i inplace`). If a
script you find online uses one of those and errors out with "calling undefined function," that's
almost certainly a `gawk`-only extension running under `mawk`.

## Combining awk with grep and sed

The three tools compose naturally in a pipeline: `grep` narrows the lines, `sed` reshapes text
within a line, and `awk` extracts and computes over fields, often with
[`sort`/`uniq -c`](/commands/sort/) closing the loop. See
[Pipes and redirection](/concepts/pipes-and-redirection/) for why chaining small,
single-purpose tools like this works as well as it does.
