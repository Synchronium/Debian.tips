---
title: "blkid"
tagline: "Identify a filesystem by label, UUID and type"
description: "Tested blkid examples: reading a filesystem's UUID, label and type, single-value output for scripts, searching by tag, and probing past the cache."
category: commands
tags: [disk, files, sysadmin]
updated: 2026-09-11
tier: light
related: [mount, mkfs, fsck, df, lsof]
---

`blkid` says what a block device holds: its filesystem type, its label and its UUID, all of them
set when [mkfs](/commands/mkfs/) made the filesystem. Those are the
three things [mount](/commands/mount/) and `/etc/fstab` name a device by, and the reason to use
them instead of `/dev/sda1` is that they follow the filesystem rather than the slot it happens to
be plugged into.

`-o value -s UUID` prints one field and nothing else, which is the form for a script. An exit status
of 2 means nothing was recognised, so an unformatted device and a missing one are the same answer.

Results come from a cache under `/run` unless `-c /dev/null` says otherwise, and a device whose
label changed since it was last probed is answered from the old reading.
