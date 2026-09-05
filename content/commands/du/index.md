---
title: "du"
tagline: "Report how much disk a directory tree uses"
description: "Tested du examples: -sh totals, --max-depth, apparent size versus allocated blocks, sparse files, hard links, excludes, and sorting the output."
category: commands
tags: [disk, files, sysadmin]
updated: 2026-08-24
tier: standard
related: [find-the-largest-files, sort, ls, find]
---

`du` walks a directory tree and reports how much disk each part of it uses. `du -sh somedir` is
the whole command most of the time: a single total, in units a person can read.

## Allocation, not length

The number `du` prints is the space allocated to a file, not the file's length. Space is handed
out in whole blocks, usually 4096 bytes, so a 10240-byte log occupies three blocks and `du`
reports 12K where [`ls -l`](/commands/ls/) reports 10240.

`--apparent-size` asks for the length instead, and the gap between the two runs both ways. A
sparse file is the extreme case: `truncate -s 100M` produces a file 100M long with no blocks
behind it at all, which `du` reports as 0. Compression, block suballocation and filesystems that
inline small files move the number too, so `du` on one tree can differ between machines where
`--apparent-size` does not.

## Reading the output

`du` prints a directory once it has finished walking it, deepest first, so a subdirectory appears
above its parent and the top of the tree is the last line rather than the first.

Siblings come out in directory order, which is neither alphabetical nor sorted by size. Anything
printing more than one line is worth piping through [`sort`](/commands/sort/), and `sort -h`
understands the suffixes `-h` produces.
[Finding the largest files](/recipes/find-the-largest-files/) is that pipeline written out.

`-s` collapses a tree to one total and `--max-depth=N` reports down to a chosen level, which is
usually a better starting point than `-a` on anything large.

## What gets counted once

Two names for one file are two directory entries and one set of blocks, and `du` counts those
blocks for whichever name it reaches first. A tree of
[hard links](/compare/hard-vs-symbolic-links/) reports the size of the data rather than the sum of
the names, unless `-l` asks for every name to be counted.

A symlink contributes its own tiny entry rather than whatever it points at, so a tree full of
links to somewhere else looks nearly empty. `-L` follows them and measures the targets.

## When du and df disagree

`du` adds up what it can reach by walking the tree. [`df`](/commands/df/) asks the filesystem how
many blocks are free. A file deleted while a process still holds it open belongs to neither, so `df` counts space
`du` cannot find, and it comes back when that process exits.
