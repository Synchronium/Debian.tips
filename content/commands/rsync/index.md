---
title: "rsync"
tagline: "Synchronise directory trees, copying only what changed"
description: "Tested rsync examples: the trailing-slash rule, dry runs, itemised output, --delete, exclude patterns, hard links and --link-dest snapshots."
category: commands
tags: [files, networking, sysadmin]
updated: 2026-09-21
tier: flagship
related: [cp, tar, ssh, copy-files-between-machines, hard-vs-symbolic-links]
---

`rsync` copies a directory tree to somewhere else and, on every run after the first, copies only
the parts that differ. That is the whole idea: where [`cp -a`](/commands/cp/) rewrites every byte
each time, `rsync` compares the two sides first and transfers the difference. Pointing it at the
same destination a second time is cheap, which is what makes it the tool for a backup, a deploy,
or any copy you expect to repeat.

Everything below runs between two local directories. `rsync` behaves the same way across a
network, where it gains its other advantage: only the changed parts cross the link. The
[copy files between machines](/recipes/copy-files-between-machines/) recipe covers that side,
including how it resumes an interrupted transfer.

## The trailing slash decides what you get

This is the one piece of `rsync` syntax that catches everybody, and it is worth learning before
anything else, because both forms succeed and they produce different trees.

A trailing slash on the **source** means *the contents of this directory*. No trailing slash means
*this directory itself*.

```bash
rsync -a site/ backup/     # backup/index.html
rsync -a site  backup/     # backup/site/index.html
```

Run the second one twice believing it to be the first, and you get `backup/site/site/`. The slash
on the destination changes nothing, so the safe habit is to put one on both sides and be
deliberate about the source.

## Reading what it did

`-v` prints filenames. `-i` (`--itemize-changes`) prints a reason for each one, and it is the more
useful of the two once the first copy is behind you:

```
>f+++++++++ about.html
>f.st...... index.html
cd+++++++++ css/
*deleting   stale.html
```

The first character is the update being made (`>` received, `c` created locally, `*` a message
rather than a transfer), the second is the file type (`f` file, `d` directory, `L` symlink). A
`+` in place of a letter means the item is being created, so no comparison was made. Otherwise a
letter marks a field that differs and a `.` marks one that matches: `s` size, `t` time,
`p` permissions, `o` owner,
`g` group, `c` checksum. So `>f.st......` reads as "sending a file whose size and time differ",
which is the ordinary case for a file you edited.

Used alone, `-i` prints no summary line, which is why the examples below prefer it. Adding `-v`
appends a transfer rate that differs on every run.

## How it decides what to copy

By default `rsync` compares **size and modification time**, and that quick check is the reason a
second run costs almost nothing. The same check is the one assumption here that can be wrong: a
file edited in place, to the same length, with its timestamp restored afterwards, matches on both
counts and is skipped.

`-c` (`--checksum`) reads both copies and compares them properly. It is correct where the quick
check is merely fast, and it costs a full read of both sides, so it belongs on the run where you
suspect something rather than on every run.

## `-a` is a bundle, not a mode

`-a` (`--archive`) is shorthand for `-rlptgoD`: recurse, copy symlinks as symlinks, preserve
permissions, times, group, owner and device files. Almost every `rsync` command wants it, and the
examples below use it throughout.

Knowing what it expands to matters when one component is wrong for the job. Owner and group need
privileges the copy may not have. `-r` on its own recurses and preserves none of the metadata,
which leaves every destination file stamped with the time it was copied rather than the time it
was written, so a later run has nothing stable to compare against.

## Deleting, carefully

`rsync` adds and updates by default. A file deleted from the source stays in the destination for
ever, so the two drift apart in one direction only. `--delete` fixes that by removing anything in
the destination the source no longer has.

It is also the flag that turns a mistyped source path into an emptied backup. Two habits make it
safe. Run it with `-n` (`--dry-run`) first and read the `*deleting` lines, and keep `--max-delete`
on any command that runs unattended, which stops the whole transfer rather than proceeding once
the count looks wrong.
