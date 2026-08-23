---
title: "wc"
tagline: "Count lines, words, bytes, or characters in text"
description: "Tested wc examples: -l/-w/-c/-m, multi-file totals, the no-trailing-newline gotcha that undercounts lines, and pairing with grep for non-blank counts."
category: commands
tags: [text-processing]
updated: 2026-08-14
tier: light
related: [sort, grep, find]
---

`wc` (word count) counts lines, words, bytes, or characters in its input. With no flags it
prints all three of lines, words, and bytes; `-l`, `-w`, `-c`, or `-m` narrow it to just one.

The line count is really a **newline count**: `wc -l` counts `\n` characters, not visual lines.
A file whose last line has no trailing newline is undercounted by one, which surprises people
debugging an off-by-one somewhere else entirely.

`-c` counts bytes and `-m` counts characters; identical for plain ASCII, but they diverge on
multi-byte UTF-8 text, where one character can span more than one byte. Multiple file arguments
add a `total` line automatically; `--total=always` or `--total=never` overrides that. `wc` has
no flag for "non-blank lines only", so `grep -c .` is the usual way to get that instead.
