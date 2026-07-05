---
title: "tar"
tagline: "Archive and compress files and directories"
description: "Tested tar examples: create, list, and extract archives, choose a compression format, and verify integrity."
category: commands
tags: [archives, files]
updated: 2026-07-05
tier: standard
related: [find, curl]
---

`tar` bundles a directory tree into a single **archive** file, preserving permissions,
ownership, and directory structure. The name is short for "tape archive," a holdover from when
the typical destination really was a tape drive, but today it's the standard way to package
source trees, backups, and release artifacts on Linux.

`tar` itself doesn't compress anything; it just concatenates files with metadata headers. The
familiar `.tar.gz` is a plain `.tar` piped through `gzip` afterwards. `tar`'s `-z`, `-j`, and
`-J` flags do exactly that pipe for you in one command, using `gzip`, `bzip2`, or `xz`
respectively.

## The three flags you'll use every time

Almost every `tar` invocation is one **mode** flag plus `-v` (verbose) plus `-f` (file):

- `-c` **create** a new archive
- `-x` **extract** an archive
- `-t` **list** an archive's contents without extracting

```bash
tar -czvf site-backup.tar.gz site/    # create, gzip, verbose, to this file
tar -tzvf site-backup.tar.gz          # list, gzip, verbose
tar -xzvf site-backup.tar.gz          # extract, gzip, verbose
```

`-f` always takes the archive filename as its argument and is usually written last, right
before the filename, since combined short flags (`-czvf`) still need their arguments in order.

> [!TIP]
> `-v` costs nothing but screen space. Leave it on. It's the difference between watching an
> extract happen and staring at a silent terminal wondering if it's stuck.

## Picking a compression format

`gzip` (`-z`) is fastest and universally supported; `xz` (`-J`) compresses noticeably smaller at
the cost of more CPU time; `bzip2` (`-j`) sits between them and is less common today. Unless
you have a specific reason otherwise, `.tar.gz` is the safe default for sharing archives, and
`.tar.xz` is worth the extra CPU when archive size matters more (release downloads, long-term
backups).

## Always verify before you trust an archive

`tar -tzf archive.tar.gz > /dev/null` reads through the whole archive and reports failure if
anything is corrupt, without writing any files to disk. Cheap insurance before you delete the
original data an archive is supposed to be backing up.
