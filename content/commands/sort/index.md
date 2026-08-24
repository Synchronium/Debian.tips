---
title: "sort"
tagline: "Sort lines: alphabetically, numerically, or by field"
description: "Tested sort examples: numeric vs lexicographic order, sorting by field with -k, human-readable sizes with -h, and checking whether a file is already sorted."
category: commands
tags: [text-processing, one-liners]
updated: 2026-08-13
tier: standard
related: [uniq, cut, find-the-largest-files]
---

`sort` orders the lines of a file or stream and writes the result to stdout. On its own that
sounds trivial, but two things trip people up constantly: **the default order is lexicographic,
not numeric**, and `sort` compares whole lines unless you tell it which field to look at.

Plain `sort` on a file of numbers puts `10` before `2`, because it's comparing the characters
`'1'` and `'2'`, not the values ten and two. `-n` switches to numeric comparison; `-h` does the
same but also understands `K`/`M`/`G` suffixes, which is what you want when sorting `du -h` or
`ls -lh` output.

For anything with columns (CSV, [`ps`](/commands/ps/) output, `du` output) `-k` picks which
field to sort by instead of the whole line: `-k2` sorts by the second field, `-t,` changes the
field separator from whitespace to a comma. Combine `-k` with `-n` or `-h` to sort a specific
numeric column correctly instead of falling back to lexicographic order on it by accident.

`-u` deduplicates while sorting (cheaper than piping to `uniq` separately when you don't need the
unsorted order preserved). `-r` reverses whatever order you asked for. `-c` checks whether a file
is already sorted without printing anything, useful in scripts as a precondition check.

Case matters too: default comparison is case-sensitive, so every uppercase letter sorts before
every lowercase one in the ASCII table, so `Cherry` lands before `apple`. `-f` folds case before
comparing, which is almost always what you want for sorting words a human will read.
