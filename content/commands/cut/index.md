---
title: "cut"
tagline: "Extract columns by field or character position"
description: "Tested cut examples: selecting fields with -f, character ranges with -c, custom delimiters, and the gotchas that push you toward awk instead."
category: commands
tags: [text-processing]
updated: 2026-08-14
tier: light
related: [sort, tr, awk]
---

`cut` extracts columns from each line of input, either by **field** (`-f`, split on a
delimiter) or by **character position** (`-c`, a fixed range regardless of content). `-d` sets
the delimiter for `-f` mode; it defaults to a tab, not a space, which surprises people the first
time they try `cut -f2` on space-separated text and get nothing useful back.

`cut` has two behaviours that catch people. First, the delimiter is exactly **one character**:
`cut -d: -f2` on `a::b` sees two single-colon splits, not one double-colon split,
so it returns an empty field, not `b`. Second, `cut` always prints selected fields in their
**original column order**, never the order you list them in `-f`: `cut -f3,1` still prints field
1 before field 3.

Multiple consecutive delimiters (like the padded columns in `ps` or `ls -l` output) create empty
fields the same way. Use `tr -s` to squeeze repeated spaces into one first, or use
[`awk`](/commands/awk/), which handles both of these cases without the workaround.
