---
title: "fsck"
tagline: "Check a filesystem, and repair it when it needs it"
description: "Tested fsck examples: checking without repairing, forcing a check past the clean flag, reading the exit status, and repairing a damaged filesystem."
category: commands
tags: [disk, files, sysadmin]
updated: 2026-09-11
tier: standard
related: [mount, mkfs, blkid, df, du]
---

`fsck` checks a filesystem's structure and offers to repair what it finds. It is a front end: the
work is done by `fsck.ext4`, `fsck.xfs` or whichever checker matches the type, and most of what
looks like `fsck`'s behaviour is really `e2fsck`'s. Running `e2fsck` directly does the same thing on
an ext filesystem and gives clearer messages.

**Never run it on a mounted filesystem.** The checker reads structures the kernel is still changing,
so it reports damage that is not there, and repairing on that basis causes the corruption it was
called to fix. Unmount first, and where that is the root filesystem, reboot into a rescue mode.
`-M` makes `fsck` skip a mounted filesystem rather than check it.

A filesystem carries a clean flag, and a check of one that is marked clean returns immediately
without looking at anything. That is why a disk with a real problem can pass instantly and why `-f`
exists: it forces the full five-pass check regardless. Give it whenever something is wrong and
`fsck` says nothing is.

The exit status is a bitmask rather than a number, and the three values worth knowing are 0 for no
errors, 1 for errors that were corrected, and 4 for errors left uncorrected. A script that treats
anything non-zero as a failure will report a successful repair as one, and 4 is the value that
actually needs a person.

What it repairs it does not always return. A file whose directory entry is gone is reconnected into
`lost+found` under its inode number rather than its name, so the recovery is of the data and not of
knowing what the data was. That directory is made by [mkfs](/commands/mkfs/) when the filesystem is,
which is why it exists on a filesystem nothing has ever gone wrong with.
