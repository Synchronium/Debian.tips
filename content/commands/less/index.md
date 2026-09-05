---
title: "less"
tagline: "Read a file a screen at a time, and search it"
description: "Tested less examples: the keys that move and search, why a piped less turns into cat, and how lesspipe lets it open a compressed file directly."
category: commands
tags: [files, terminal, beginner]
updated: 2026-08-28
tier: standard
related: [cat, head, tail, journalctl]
---

`less` shows a file a screen at a time and lets you move around inside it. It is Debian's default
pager, so [`man`](/commands/man/), [systemctl](/commands/systemctl/) and
[journalctl](/commands/journalctl/) all
hand their output to it. The shared inheritance is why they all quit on `q`, and why several of
them grew a `--no-pager` flag.

The keys are what no example can show. All of these are listed by
`less --help`, and `h` prints the same list without leaving the file.

| Key | What it does |
| --- | --- |
| `q` | quit |
| `SPACE`, `b` | forward, back one screen |
| `g`, `G` | first line, last line |
| `/text`, `?text` | search forward, search backward |
| `n`, `N` | next match, previous match |
| `&text` | show only the lines that match |
| `F` | keep reading as the file grows, like `tail -f`; `Ctrl-C` stops |
| `v` | open the file in `$VISUAL` or `$EDITOR` |
| `-N` then `Enter` | turn line numbers on or off without restarting |

Searching is case-sensitive. `-i` makes it ignore case for any pattern with no capital letter in
it, and `-I` ignores case whatever the pattern looks like.

The behaviour that catches people out is on the other side. `less` pages only while it is talking
to a terminal. Send it into a pipe or a file and it copies its input straight through, ignoring
every display flag you gave it, so `less -N report.txt > numbered.txt` writes a file with no
numbers in it.
