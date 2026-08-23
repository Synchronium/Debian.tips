---
title: "Copy files between two machines over SSH"
description: "Transfer a file or directory tree between two machines with scp or rsync, and resume an interrupted transfer without starting over."
category: recipes
tags: [ssh, networking, files]
updated: 2026-07-05
related: [ssh, tar, find]
---

**Problem:** You need to copy a file or directory from one machine to another, and both machines
have SSH access to each other but nothing more elaborate set up.

**Solution:**

```bash
scp report.pdf deb1:/home/user/backups/
ssh deb1 ls /home/user/backups/
```
```
report.pdf
```

**How it works:**

- `scp` copies over the same SSH connection you'd use to log in, so it needs no separate server
  or setup beyond working SSH access. It prints a progress meter while a transfer is running and
  **nothing at all on success** once it finishes in a script or a pipeline, which is why the
  listing above is the confirmation rather than anything `scp` said. `deb1` here is a host alias
  from `~/.ssh/config` rather than a raw hostname; see [ssh](/commands/ssh/) for setting one up
  along with key-based auth so neither `scp` nor `rsync` prompts for a password.
- `deb1:/home/user/backups/` is `host:path`; the trailing slash means "into this directory,"
  keeping the original filename.
- Reverse the arguments to copy in the other direction: `scp deb1:/path/to/file.txt .` pulls a
  file from the remote host to the current directory.

**Variations:**

```bash
# Copy an entire directory tree
scp -r project/ deb1:/home/user/
```

<!-- verify: shape the byte counts, the transfer rate and the speedup ratio depend on the files and the link -->
```bash
# rsync: only transfers what changed
rsync -avz project/ deb1:/home/user/project/
```
```
sending incremental file list
a.txt

sent 140 bytes  received 35 bytes  350.00 bytes/sec
total size is 18  speedup is 0.10
```

`rsync -avz` (`-a` archive mode, preserving permissions and timestamps; `-v` verbose; `-z`
compress in transit) is worth preferring over `scp` for anything beyond a one-off file: run
the same command again after an interruption or a partial sync, and it only transfers files
that are new or changed, rather than starting the whole copy over. A second difference shows up
on large trees: `scp` reads the whole source list into memory before it starts,
while `rsync` streams it, so it copes better with directories containing very large numbers of
files.

> [!TIP]
> Preview exactly what `rsync` would do without touching anything by adding `-n` (`--dry-run`):
> `rsync -avzn project/ deb1:/home/user/project/` prints the file list it would transfer and
> stops there.

The trailing slash on the source path (`project/` vs `project`) matters for both tools: with the
slash, the *contents* of `project/` land directly in the destination directory; without it, the
`project` directory itself is created as a subdirectory of the destination.
