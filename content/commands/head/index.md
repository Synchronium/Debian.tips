---
title: "head"
tagline: "Show the first part of a file"
description: "Tested head examples: -n and -c, multiple files and their headers, the -n -N form that drops the last lines, and stopping a pipeline early."
category: commands
tags: [text-processing, files]
updated: 2026-08-23
tier: light
related: [tail, cat, grep, sort, wc]
---

`head` prints the first 10 lines of each file it is given, or of standard input. `-n` changes the
count and `-c` counts bytes instead of lines.

A negative count inverts the job: `head -n -5` prints everything **except** the last 5 lines,
which drops a trailer without needing to know how long the file is.

In a pipeline `head` exits as soon as it has its lines, closing the pipe and sending `SIGPIPE` to
whatever was writing, so `grep error huge.log | head -3` stops searching once three matches exist.
That saving does not apply to a command which must consume all its input before producing any, of
which `sort` is the obvious one.

[`tail`](/commands/tail/) is the other end of the same file, and the two compose:
`head -n15 report.txt | tail -n3` gives lines 13 to 15.
