#!/usr/bin/env bash
# Fixtures for content/compare/hard-vs-symbolic-links.md.
#
# verify: --user
#
# Most blocks make their own links, because the `ln` command is half of what the block is
# showing and a reader landing mid-page should be able to run it. What cannot be made inline is
# the pair of backup directories: the page's disk-space claim needs a file big enough that the
# space it occupies is legible next to the 4K a directory costs, and a `dd` at the top of that
# block would bury the `du` underneath it.
#
# Replayed as `user` because the page's subject is what an ordinary account can do to its own
# files, and root would be able to link across an ownership boundary the page never mentions.

mkdir -p backups/daily-1 backups/daily-2

# 64K exactly, so `du -sh` reports a round figure and the directory's own 4K is visible as the
# difference rather than lost in rounding. Zeros rather than random bytes: nothing here reads the
# contents, and a sparse file would report a size it does not occupy.
dd if=/dev/zero of=backups/daily-1/archive.tar bs=1K count=64 status=none

chmod 644 backups/daily-1/archive.tar
chmod 755 backups backups/daily-1 backups/daily-2
