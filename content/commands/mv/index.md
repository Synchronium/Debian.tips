---
title: "mv"
tagline: "Rename a file, or move it somewhere else"
description: "Tested mv examples: renaming and moving files, why a second mv nests a directory inside itself, and what changes once the destination is another filesystem."
category: commands
tags: [files, beginner]
updated: 2026-08-28
tier: light
related: [cp, rm, text-file-busy, ls, bulk-rename-files]
---

Debian has no `rename` command installed by default, and `mv` does that job instead. Renaming
and moving are one operation: `mv` changes an entry in a directory, and whether the old and new
entries live in the same directory is not something it needs to care about.

That holds only within one filesystem. Move a file to another one and `mv` copies the bytes and
deletes the original, so the file gets a new inode, the command takes as long as the file is big,
and an interrupted move can leave a partial copy behind. Within one filesystem the rename is
atomic, which is what makes `mv` the way to replace a file that something else is reading or
[running](/troubleshooting/text-file-busy/).

`mv` overwrites an existing destination without asking. Moving a directory onto a name that
already exists puts it inside rather than replacing it, which is the same trap `cp -r` sets.
