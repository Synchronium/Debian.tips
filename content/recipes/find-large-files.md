---
title: "Find the largest files on disk"
description: "Locate what's actually eating your disk space, from a whole filesystem down to one directory."
category: recipes
tags: [disk, files, one-liners]
updated: 2026-07-05
---

**Problem:** Disk space is running low and you need to find out what's using it.

**Solution:**

```bash
du -ah /var | sort -rh | head -20
```

**How it works:**

- `du -ah /var` prints the disk usage of every file and directory under `/var`, in
  human-readable sizes (`-h`) — including individual files, not just directory totals (`-a`).
- `sort -rh` sorts that output by size, largest first (`-r` reverse, `-h` understands
  human-readable sizes like "1.2G").
- `head -20` keeps just the top 20 results.

**Variations:**

```bash
du -ah . | sort -rh | head -20        # current directory instead of the whole filesystem
du -sh */ | sort -rh                  # top-level directories only, not every file
find / -xdev -size +500M -exec ls -lh {} \;   # only files over 500MB, one filesystem
```

> [!NOTE]
> `find -xdev` stays on one filesystem — without it, a search from `/` also descends into
> mounted drives, network shares, and `/proc`, which is rarely what you want.
