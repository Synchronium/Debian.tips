---
title: "head and tail"
tagline: "Show the first or last part of a file"
description: "Tested head and tail examples: -n and -c, multiple files, negative/plus offsets, and following a growing log with -f vs -F."
category: commands
tags: [text-processing, monitoring]
updated: 2026-08-14
tier: standard
related: [grep, sort, monitor-a-log-in-real-time]
---

`head` prints the first part of a file; `tail` prints the last part. Both default to 10 lines,
both take `-n` to change that count and `-c` to work in bytes instead of lines, and both accept
multiple files, printing a `==> filename <==` header before each.

Two flags are GNU extensions worth knowing: `head -n -5` means "all but the last 5 lines," and
`tail -n +5` means "from line 5 to the end." They read almost like opposites, and combining them
(`head -n15 file | tail -n3` gives lines 13 through 15) is a common way to pull a specific slice
out of the middle of a file without resorting to `sed`.

`tail`'s other job is watching a file grow: `-f` follows a file as new lines are appended, the
standard way to [watch a log in real time](/recipes/monitor-a-log-in-real-time/). Plain `-f`
follows the file's original inode, so if the file gets rotated out from under it (renamed, and a
new file created with the old name, which is exactly what `logrotate` does), `-f` keeps watching
the old, now-disconnected file and stops seeing new content. `-F` (`--follow=name --retry`)
notices the replacement and switches to the new file automatically.
