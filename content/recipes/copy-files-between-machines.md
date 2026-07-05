---
title: "Copy files between two machines over SSH"
description: "Transfer a file or directory tree between two machines with scp or rsync, and resume an interrupted transfer without starting over."
category: recipes
tags: [ssh, networking, files]
updated: 2026-07-05
related: [tar, find]
---

**Problem:** You need to copy a file or directory from one machine to another, and both machines
have SSH access to each other but nothing more elaborate set up.

**Solution:**

```bash
scp report.pdf deb1:/home/user/backups/
```

**How it works:**

- `scp` copies over the same SSH connection you'd use to log in, so it needs no separate server
  or setup beyond working SSH access.
- `deb1:/home/user/backups/` is `host:path`; the trailing slash means "into this directory,"
  keeping the original filename.
- Reverse the arguments to copy in the other direction: `scp deb1:/path/to/file.txt .` pulls a
  file from the remote host to the current directory.

**Variations:**

```bash
# Copy an entire directory tree
scp -r project/ deb1:/home/user/

# rsync: only transfers what's actually changed
rsync -avz project/ deb1:/home/user/project/
```
```
sending incremental file list
a.txt

sent 190 bytes  received 36 bytes  452.00 bytes/sec
total size is 23  speedup is 0.10
```

`rsync -avz` (`-a` archive mode, preserving permissions and timestamps; `-v` verbose; `-z`
compress in transit) is worth reaching for over `scp` for anything beyond a one-off file: run
the same command again after an interruption or a partial sync, and it only transfers files
that are new or changed, rather than starting the whole copy over. A second real difference
that matters for large trees: `scp` reads the whole source list into memory before it starts,
while `rsync` streams it, so it copes better with directories containing very large numbers of
files.

> [!TIP]
> Preview exactly what `rsync` would do without touching anything by adding `-n` (`--dry-run`):
> `rsync -avzn project/ deb1:/home/user/project/` prints the file list it would transfer and
> stops there.

The trailing slash on the source path (`project/` vs `project`) matters for both tools: with the
slash, the *contents* of `project/` land directly in the destination directory; without it, the
`project` directory itself is created as a subdirectory of the destination.
