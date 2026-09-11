---
title: "mount"
tagline: "Attach a filesystem to a directory, and see what is attached"
description: "Tested mount examples: attaching a filesystem by device, label or UUID, reading the options in force, bind mounts, fstab, and busy unmounts."
category: commands
tags: [disk, files, sysadmin]
updated: 2026-09-11
tier: standard
related: [df, du, mkfs, fsck, blkid, lsof]
---

`mount` attaches a filesystem to a directory, and that directory's contents are whatever the
filesystem holds for as long as it stays attached. Anything that was in the directory beforehand is
hidden rather than deleted, and comes back when the filesystem is unmounted.

Run with no arguments it lists what is mounted, which on a desktop is dozens of kernel filesystems
you did not attach and are not looking for. `findmnt` is the better reader: it takes the same
information from `/proc/self/mountinfo`, prints it as a tree or a table, and accepts a path so you
can ask about one mount rather than filtering the lot. `findmnt --target somefile` answers which
filesystem a given file is actually on, which is the question behind most uses of `df`.

The device can be named three ways. `/dev/sda1` is the direct one and the one that moves when a
disk is added; `LABEL=` and `UUID=` are looked up through [blkid](/commands/blkid/) and stay right
across a reboot that renumbers the disks. Use one of the latter two in
[/etc/fstab](/concepts/filesystem-hierarchy/), where a wrong answer stops the machine booting.

Options are the part worth reading twice. `-o ro,noexec,nosuid,nodev` is the set that makes a
filesystem safe to look at rather than to run, and `findmnt -o OPTIONS` prints what is actually in
force rather than what was asked for. A remount changes them without detaching anything, which is
how a filesystem goes read-only under a running service.

A `umount` that reports the target is busy is not a failure to fix with `-f`. Something has a file
open on it or a working directory inside it, and [fuser -m](/commands/fuser/) or
[lsof](/commands/lsof/) will say what. `umount -l` detaches the filesystem from the tree and lets
the last user finish with it, which is the right answer when the holder cannot be stopped.
