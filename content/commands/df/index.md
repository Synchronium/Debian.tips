---
title: "df"
tagline: "Report free space, per filesystem"
description: "Tested df examples: reading the output, asking about the filesystem a path is on, choosing columns and units, and the full disk that still reports free space."
category: commands
tags: [disk, sysadmin, files]
updated: 2026-08-31
related: [du, find-the-largest-files, ls, processes-and-signals]
tier: light
---

`df` reports free space per **filesystem**, and [`du`](/commands/du/) adds up the size of
**files**. That is the whole difference between them, and it is why they disagree: `df` asks the
kernel, and `du` walks a tree and can only count what it is allowed to see.

Give it a path and it answers about whatever filesystem that path is on, so `df -h .` is usually
the fastest way to find out whether the thing you are about to write will fit. Give it nothing
and it lists every mounted filesystem, most of which on a modern Debian system are `tmpfs`
pseudo-filesystems that hold no files you put there.

## Two ways a disk fills up

Space is one. The other is the inode table, which holds one entry per file and is fixed when the
filesystem is created. Exhaust it and writes fail with `No space left on device` while `df -h`
still reports gigabytes free. Only `df -i` shows it, and it is a cheaper thing to learn
before you need it than during.
