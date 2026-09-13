---
title: "No space left on device"
tagline: "Which filesystem, what filled it, and what is safe to remove"
description: "A write failed for want of space. Find which filesystem is full, whether it ran out of blocks or inodes, and why deleting the big file often frees no space."
category: troubleshooting
tags: [disk, sysadmin, files]
updated: 2026-09-12
related: [df, du, lsof, find-the-largest-files, filesystem-hierarchy]
---

Something refused to write and blamed the disk. Every program words it differently, because they
are all reporting the same thing the kernel told them: errno 28, `ENOSPC`, which
`strerror` renders as "No space left on device". Here it is from `cp`, on a filesystem with about
a megabyte left:

```bash
cp /srv/disk/var/log/tips/app.log /srv/disk/app.log.1
df -h /srv/disk
```
```
cp: error copying '/srv/disk/var/log/tips/app.log' to '/srv/disk/app.log.1': No space left on device
Filesystem      Size  Used Avail Use% Mounted on
tmpfs            20M   20M     0 100% /srv/disk
```

Note that the partial copy is still there. A failed write usually leaves what it managed before
running out, so the first attempt at a fix has often made the problem slightly worse.

## Which filesystem, rather than which disk

[df](/commands/df/) takes a path and answers about the filesystem that path is on, which is the
form worth using. A Debian system with a separate `/var` or `/home` can have one filesystem full
and gigabytes free elsewhere. A bare `df -h` hands you every filesystem on the machine to read
through at the moment you least want to.

```bash
df -h /srv/disk | tail -1
```
```
tmpfs            20M   19M  1.8M  92% /srv/disk
```

Root reserves a percentage of every ext4 filesystem for itself, five by default, so a filesystem
that is full for your service still has room for root to log in and clean up. It also means
`Use%` can read 100% while `Avail` is not quite zero.

## When df says there is room

The other way a filesystem fills up is that it runs out of inodes, one of which is spent per file
regardless of how small the file is. A maildir, a spool directory or a cache of tiny objects gets
there long before it runs out of blocks:

```bash
touch /srv/small/message-32.eml
df -h /srv/small
df -i /srv/small
```
```
touch: cannot touch '/srv/small/message-32.eml': No space left on device
Filesystem      Size  Used Avail Use% Mounted on
tmpfs            10M  124K  9.9M   2% /srv/small
Filesystem     Inodes IUsed IFree IUse% Mounted on
tmpfs              32    32     0  100% /srv/small
```

Two per cent used, and not a single file can be created. `df -i` is worth running whenever the
space figures look healthy and the error says otherwise: the two cases print the same message, and
no other part of it tells them apart.

An ext4 filesystem's inode count is fixed when [mkfs](/commands/mkfs/) makes it, so the repair is
to delete files rather than to add space. Growing the filesystem does not add inodes.

## Finding what is using the space

[du](/commands/du/) reports what is under a directory, and `-x` keeps it on one filesystem, which
stops a walk of `/` descending into every mount on the machine:

```bash
du -xh --max-depth=2 /srv/disk | sort -h
```
```
4.0K	/srv/disk/home
4.0K	/srv/disk/home/user
256K	/srv/disk/var/lib
3.0M	/srv/disk/var/cache
11M	/srv/disk/var/log
15M	/srv/disk
15M	/srv/disk/var
```

`sort -h` puts the totals in order and understands the `K`, `M` and `G` suffixes, so the answer is
the bottom of the list. Descend one level at a time from whichever line is largest.

Where a single file rather than a directory is the problem, `-a` counts files as well as
directories:

```bash
du -xah /srv/disk | sort -h | tail -6
```
```
3.0M	/srv/disk/var/cache/tips
11M	/srv/disk/var/log
11M	/srv/disk/var/log/tips
11M	/srv/disk/var/log/tips/app.log
15M	/srv/disk
15M	/srv/disk/var
```

A parent and its child appearing with the same figure, as `/srv/disk/var/log` and its `tips`
directory do here, means everything in the parent is in that child.
[Find the largest files](/recipes/find-the-largest-files/) has the `find` forms for the same
question, which are better when you want files above a size wherever they are rather than a total
per directory.

## When df and du disagree

```bash
df -h /srv/disk | tail -1
du -shx /srv/disk
```
```
tmpfs            20M   19M  1.8M  92% /srv/disk
15M	/srv/disk
```

Four megabytes are being used by nothing `du` can find. `du` adds up the files it can reach by
name, while `df` asks the filesystem how many blocks are allocated. A file that a process still
has open after it was deleted is allocated and unreachable at the same time. The blocks come back when
the process closes it or exits, and not before.

[lsof](/commands/lsof/) lists those files, with `-a` to combine the two conditions rather than
matching either:

<!-- verify: shape the PID, the device number and the inode belong to this machine -->
```bash
lsof -a +L1 /srv/disk
```
```
COMMAND   PID USER FD   TYPE DEVICE SIZE/OFF NLINK NODE NAME
tips-spoo 641 root 3w   REG   0,88  4194304     0   20 /srv/disk/var/lib/tips/spool.tmp (deleted)
```

`NLINK 0` is the deleted part, `SIZE/OFF` is what it costs, and the process in the first column is
the one holding it. Restarting that service returns the space:

```bash
df -h /srv/disk | awk 'NR==2 {print "used before: " $3}'
pkill -x tips-spool
sleep 1
df -h /srv/disk | awk 'NR==2 {print "used after: " $3}'
```
```
used before: 19M
used after: 15M
```

This is the usual reason a disk stays full after somebody has deleted several gigabytes of logs.
The files are gone and the space is not. It stays that way until the service that had them open
is restarted.

## Deleting a log a service is holding

Same mechanism, met from the other side. `rm` on a log file a running service has open removes the
name without freeing a single block:

```bash
rm /srv/disk/var/log/tips/app.log
df -h /srv/disk | awk 'NR==2 {print "used after rm: " $3}'
```
```
used after rm: 19M
```

The file is now invisible to `du`, still costing eleven megabytes, and the service is still writing
into it. Truncating the file instead keeps the name, keeps the service's descriptor valid and
returns the blocks:

```bash
: > /srv/disk/var/log/tips/app.log
df -h /srv/disk | awk 'NR==2 {print "used after truncating: " $3}'
```
```
used after truncating: 7.3M
```

Both blocks above start from the same filesystem, so they are two answers to one situation rather
than a sequence. `: > file` is the shell writing nothing to a file opened for truncation;
`truncate -s 0 file` is the same thing spelled out. Either one works on a log, and neither
needs the service stopped.

> [!WARNING]
> A service that opens its log with `O_APPEND`, which is most of them, carries on appending after a
> truncation and the file grows from zero. One that tracks its own offset instead writes at the
> offset it had, so the file comes back as a sparse file reporting its old size. `logrotate` with
> `copytruncate` exists for exactly this. A service that can reopen its log on `SIGHUP` should be
> sent one rather than truncated under.

## What is safe to remove on Debian

In the order worth trying, once you know which filesystem is full:

- **The apt cache.** `apt clean` empties `/var/cache/apt/archives`, which holds every `.deb`
  downloaded since the last clean. On a long-lived server this is often gigabytes that
  no longer belong to anything: apt downloads a package again if it ever wants it back.
- **The journal.** `journalctl --disk-usage` reports what it is holding, and
  `journalctl --vacuum-size=200M` or `--vacuum-time=7d` trims it. Setting `SystemMaxUse=` in
  `/etc/systemd/journald.conf` stops it recurring, which the vacuum on its own does not.
- **Old kernels.** `apt autoremove --purge` removes the ones Debian has already marked. `/boot`
  being small and separate is the usual reason a machine hits this filesystem first. Never delete a kernel
  package's files by hand.
- **Rotated logs.** `/var/log/*.gz` and `*.1` are yesterday's, so deleting them is safe. Deleting
  the live log is the case above.

What not to do is `rm -rf /var/log/*`, which takes the files services are writing to along with the
rotated ones and leaves you with the deleted-and-held problem across every service at once. And
before deleting anything large, check that the space is not already accounted for by something
still running: `lsof -a +L1 /` answers that in one line.
