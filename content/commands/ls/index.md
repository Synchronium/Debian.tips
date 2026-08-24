---
title: "ls"
tagline: "List directory contents"
description: "Tested ls examples: the long format column by column, hidden files, sorting by time and size, symlinks, time styles, and why piped output looks different."
category: commands
tags: [files, beginner, terminal]
updated: 2026-08-23
tier: flagship
related: [find, chmod, file-permissions-explained, find-the-largest-files]
---

`ls` lists what is in a directory. Given no arguments it lists the current one, given a directory
it lists that directory's contents, and given a file it lists that file.

## Its output changes depending on where it is going

This catches people out when a command works at the prompt and behaves differently in a script.
`ls` checks whether its standard output is a terminal. When it is, it arranges names in columns
across the width of the window and may add colour. When output goes to a pipe or a file, it
switches to one name per line and drops the colour.

That is why `ls | wc -l` counts entries correctly while the same listing on screen shows four
across a line. Both are `ls` doing what it was asked. `-1` forces one per line and `-C` forces
columns, so a script that cares should say which it wants rather than inherit the default.

**Every example on this page was captured through a pipe**, so the listings below are the
one-per-line form. At a terminal, the short ones will appear in columns.

## The long format, column by column

`-l` is the flag worth knowing properly, because six of its seven columns answer a different
question:

```
-rw-r--r-- 1 user user 10240 Jun 21 10:00 app.log
```

The first character is the entry type: `-` for a regular file, `d` for a directory, `l` for a
symlink. The next nine are the permission bits in three groups of three, covered in
[file permissions explained](/concepts/file-permissions-explained/). Then the link count, the
owner, the group, the size in bytes, the modification time, and the name.

Two of those mislead if taken at face value. The **size** of a directory (usually 4096) is the
size of the directory file itself, rather than of what it contains; adding up a tree's real size
is [`du`](/commands/du/)'s job, as in
[find the largest files](/recipes/find-the-largest-files/). And the **link
count** on a directory is the number of subdirectories it holds plus two, because every directory
contains `.` and every child of it contains `..`.

The `total` line above the listing is disk blocks used by that directory's entries, in units of
1024 bytes by default. It counts allocated blocks rather than bytes, so it will not match the
sum of the size column, and it ignores subdirectory contents.

## Hidden files, and the two flags for them

A leading dot in a filename hides that file from a default listing. `-a` shows everything
including the `.` and `..` entries that every directory contains; `-A` shows everything except
those two. `-A` is almost always the one you want, even though `-a` is the one everybody types.

## Sorting

The default is by name, using the locale's collation rules rather than raw byte order, so
`LC_COLLATE` decides whether `Cherry` sorts before `apple`. The other orders are `-t` by
modification time, `-S` by size, `-X` by extension and `-v` by version number, which sorts
`file10` after `file9` where the default sorts it before. Each of them puts the largest or most
recent first, and `-r` reverses whichever order is in effect.

`ls -ltr` is worth committing to memory: long format, sorted by time, reversed, so the most
recently modified file is the last line printed and does not scroll away.

## Which timestamp

`ls -l` shows the modification time, when the file's contents last changed. `-u` shows the access
time and `-c` the change time, which is when the inode last changed: a `chmod` or a rename updates
`ctime` without touching `mtime`. There is no creation time here, because most Linux filesystems
did not record one until recently and `ls` still does not read it.

The date format depends on the age. Files modified within the last six months show a month, day
and time; older ones show a month, day and year, on the grounds that the year is more important
than the minute once something is that old. `--time-style=long-iso` gives `2026-06-21 10:00` for
everything and is the better choice whenever the output will be read by anything other than a
person.

## Symlinks

`ls -l` shows a symlink as `l` with an arrow to its target, and reports the size of the link
itself rather than of what it points at. `-L` follows the link and describes the target instead.
A link whose target no longer exists is still listed without complaint, which is why a broken
symlink is easy to miss.
