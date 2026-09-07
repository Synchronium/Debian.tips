---
title: "stat"
tagline: "Read a file's size, mode, owner and timestamps"
description: "Tested stat examples: reading size, mode, owner and the three timestamps, printing a single field with -c, and what stat says about a symlink."
category: commands
tags: [files, permissions, scripting]
updated: 2026-09-07
tier: standard
related: [ls, touch, date, chmod, find, file-permissions-explained]
---

`stat` prints what the filesystem records about a name: size, mode, owner, link count, the three
timestamps, and the inode number that holds them all. None of the contents are read, so it answers
as quickly for a hundred-gigabyte image as for an empty file.

Run on its own it prints a formatted block of every field at once. `-c` replaces that block with a
format string of your own, which is how `stat` usually appears in a script: `stat -c %s report.csv`
is the size and nothing else, ready to go straight into a variable. [ls](/commands/ls/) shows a
subset of the same fields, with its own spacing and its own rules about when to abbreviate a date,
so it is the better one to read and the worse one to parse.

The three timestamps are separate things and get confused for each other. Access is when the
contents were last read, modification is when they were last written, and change is when the inode
was last altered, so a rename or a `chmod` moves the change time while leaving the modification
time alone. [touch](/commands/touch/) can set the first two, and nothing can set the third.

One default is the reverse of what most commands do: given a symlink, `stat` describes the link
itself rather than the file at the end of it. `-L` follows it.
