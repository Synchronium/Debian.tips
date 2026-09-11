---
title: "dd"
tagline: "Copy blocks, with control over size and position"
description: "Tested dd examples: making disk images, choosing a block size, seek and skip, conv=notrunc, sparse files, and why the output argument is the dangerous one."
category: commands
tags: [disk, files, sysadmin]
updated: 2026-09-11
tier: standard
related: [mkfs, mount, blkid, du, df]
---

`dd` copies bytes from one place to another in fixed-size blocks, and its interest is the control:
where in the input to start, where in the output to write, how much, and whether to truncate what
was there. `cp` can do none of that, which is why `dd` survives despite a syntax that belongs to a
different decade.

The syntax is its own: `if=` and `of=` rather than positional arguments, no dashes, and no spaces
around the equals. Everything unrecognised is a silent no-op, so `dd if=disk.img of=/dev/sdb bs 1M`
runs with the default 512-byte block and finishes an hour later than expected.

**The `of=` argument is the one that destroys things.** `dd` writes wherever it is pointed, to a
device as readily as to a file, and gets `/dev/sdb` and `/dev/sdc` confused about as often as
anyone does. Run [lsblk](/commands/mount/) or [blkid](/commands/blkid/) on the target immediately
before, in the same terminal, so what you read is what you type.

Block size is a throughput setting and nothing else: `bs=1M` moves the same bytes as the default
`bs=512` in a fraction of the calls. Where `bs` does change the result is with `count`, `skip` and
`seek`, which are all counted in blocks rather than bytes, so `count=5` means five of whatever `bs`
says.

By default `dd` truncates the output file. `conv=notrunc` is what lets it write into the middle of
one, and leaving it out is how a patch of a few bytes turns into a file three bytes long.
