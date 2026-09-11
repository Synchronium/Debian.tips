---
title: "mkfs"
tagline: "Make a filesystem on a device or in a file"
description: "Tested mkfs examples: making an ext4 filesystem, setting a label and UUID, choosing block and inode counts, and checks before formatting."
category: commands
tags: [disk, files, sysadmin]
updated: 2026-09-11
tier: standard
related: [mount, dd, blkid, fsck, df]
---

`mkfs` writes a new, empty filesystem over whatever was there, on a device or in a file that
[dd](/commands/dd/) made. There is no confirmation step and
nothing to undo it, so the argument is worth reading twice: [blkid](/commands/blkid/) on the device
first will say what you are about to destroy.

Like [fsck](/commands/fsck/) it is a front end that dispatches by type. `mkfs -t ext4` runs
`mkfs.ext4`, which is `mke2fs` under another name, and a type whose helper is not installed fails
with a message about the helper rather than about the filesystem. Debian keeps each one in its own
package, so `mkfs.vfat` needs `dosfstools` and `mkfs.xfs` needs `xfsprogs`.

Give `-q` unless you want to watch it work. The ordinary output reports progress with backspaces
and trailing padding, which reads correctly on a terminal and is unusable anywhere else.

Three things are decided at creation and cannot be changed afterwards without remaking the
filesystem: the block size, the inode count and the inode size. The defaults come from
`/etc/mke2fs.conf` and suit a general-purpose disk. A filesystem holding a million small files runs
out of inodes long before it runs out of space, and `df -i` is what shows it happening.

The label and the UUID can be changed later with `tune2fs`, but setting them here is what lets an
`/etc/fstab` entry name the filesystem rather than the device it happened to appear as.
