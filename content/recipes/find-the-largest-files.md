---
title: "Find the largest files on disk"
tagline: "du, sort and head, aimed at any directory"
description: "Locate what is eating your disk space, from a whole filesystem down to one directory."
category: recipes
tags: [disk, files, one-liners]
updated: 2026-08-22
related: [find, tar, sort, head]
---

**Problem:** Disk space is running low and you need to find out what's using it.

**Solution:**

```bash
du -ah projects | sort -rh | head -6
```
```
2.6M	projects
2.1M	projects/archive
2.0M	projects/archive/backup.tar.gz
568K	projects/logs
500K	projects/logs/app.log
64K	projects/logs/access.log
```

**How it works:**

- `du -ah projects` prints the disk usage of every file and directory underneath it, in
  human-readable sizes (`-h`), including individual files, not just directory totals (`-a`).
  Point it at `/var` or `/` for the real investigation; a small tree is used here so the
  numbers on this page are ones you can reproduce.
- `sort -rh` sorts that output by size, largest first (`-r` reverse, `-h` understands
  human-readable sizes like "1.2G"). See [sort](/commands/sort/) for more, including the
  common mistake of using `-h` without also telling it which field to sort by.
- `head -6` keeps just the top of the ranking (see [head](/commands/head/)). Use
  `head -20` on a real filesystem, where there is far more to sift through.

Note that directories and their contents both appear: `projects/archive` at 2.1M is the
directory holding `backup.tar.gz` at 2.0M, not a second copy of it. `-a` was asked for every
file, so the totals down the column add up to more than the disk holds.

**Variations:**

```bash
du -ah . | sort -rh | head -20        # current directory instead of the whole filesystem
du -sh */                             # top-level directories only, not every file
find /var -size +500k -exec ls -lh {} \;   # only files over a size threshold
```

Restricting to top-level directories first (`du -sh */`) is often the faster starting point on
a large filesystem: it tells you which subtree to dig into with the full `du -ah` command,
rather than sorting through every individual file up front.

> [!NOTE]
> Searching from `/` rather than a specific directory like `/var`? Add `-xdev` to the `find`
> variation: `find / -xdev -size +500M -exec ls -lh {} \;`. Without it, a search from `/` also
> descends into mounted drives, network shares, and `/proc`, which is rarely what you want. See
> [find](/commands/find/) for more on `-xdev` and other filters.

If the culprit turns out to be an old backup archive rather than a single runaway file, look
inside it before deleting: `tar -tzvf backup.tar.gz` lists contents with sizes without
extracting anything (see [tar](/commands/tar/)).

For repeated disk investigations, `ncdu` (not installed by default; `apt install ncdu`) gives
the same information as the `du` command above and lets you walk the tree, instead of re-running
the command with a different path each time.
