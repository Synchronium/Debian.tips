---
title: "Find the largest files on disk"
description: "Locate what's actually eating your disk space, from a whole filesystem down to one directory."
category: recipes
tags: [disk, files, one-liners]
updated: 2026-07-05
related: [find, tar]
---

**Problem:** Disk space is running low and you need to find out what's using it.

**Solution:**

```bash
du -ah /var | sort -rh | head -20
```
```
2.5M	/var
2.0M	/var/cache/big.dat
2.0M	/var/cache
504K	/var/log
500K	/var/log/syslog
8.0K	/var/small.txt
```

**How it works:**

- `du -ah /var` prints the disk usage of every file and directory under `/var`, in
  human-readable sizes (`-h`), including individual files, not just directory totals (`-a`).
- `sort -rh` sorts that output by size, largest first (`-r` reverse, `-h` understands
  human-readable sizes like "1.2G").
- `head -20` keeps just the top 20 results.

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

If the culprit turns out to be an old backup archive rather than a single runaway file, checking
what's actually inside it before deleting is worth the extra step: `tar -tzvf backup.tar.gz`
lists contents with sizes without extracting anything (see [tar](/commands/tar/)). For repeated
disk investigations, the interactive tool `ncdu` (not installed by default; `apt install ncdu`)
gives the same information as the `du` command above but lets you navigate the tree interactively
instead of re-running the command with a different path each time.
