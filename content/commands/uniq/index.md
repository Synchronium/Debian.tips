---
title: "uniq"
tagline: "Collapse or count adjacent duplicate lines"
description: "30 tested uniq examples: why input must be sorted first, counting occurrences with -c, and isolating only the duplicates or only the singles."
category: commands
tags: [text-processing, one-liners]
updated: 2026-08-13
tier: light
related: [sort, cut]
---

`uniq` removes duplicate lines — but only when they're **adjacent**. It doesn't scan the whole
file for repeats; it just compares each line to the one before it. Unsorted input with
duplicates scattered throughout it will pass straight through `uniq` unchanged. That's why
`uniq` almost always shows up right after `sort` in a pipeline: `sort | uniq` groups matching
lines together first, so `uniq` actually has something adjacent to collapse.

`-c` prefixes each line with how many times it occurred — the basis of the classic
`sort | uniq -c | sort -rn` frequency-count pipeline. `-d` prints only lines that had duplicates;
`-u` prints only lines that didn't. `-i` folds case before comparing. `-f N` and `-s N` skip the
first N fields or characters before comparing, useful when only part of each line should count
toward "duplicate."
