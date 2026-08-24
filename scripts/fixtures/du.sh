#!/usr/bin/env bash
# Fixtures for content/commands/du/examples.yaml. Must match its `fixtures:` block.
#
# The tree is `mk_projects` in _common.sh, the same sample data the find and ls pages document.
# Sizes there are written byte for byte rather than with `truncate`, which is what lets this page
# quote exact block counts: `logs/big.log` is 6291456 bytes, which is 1536 blocks of 4K on any
# filesystem with a 4K block size, and `logs/app.log` is 10240 bytes, which is two and a half
# blocks and therefore rounds up to three.
#
# Two additions sit beside the tree rather than inside it, so `projects/` stays identical to what
# the other pages show.

. /tmp/fixtures-common.sh

mk_projects

# A sparse file: 100M of addressable file with no blocks behind it. This is the page's sharpest
# demonstration that `du` measures allocation rather than length, and it is the one case where
# `du` and `ls -l` disagree by the whole size of the file.
truncate -s 100M disk-image.img
chmod 644 disk-image.img
touch -d "2026-06-26 10:00:00" disk-image.img
chown user:user disk-image.img 2>/dev/null || true

# Two names for one inode. `du` counts the blocks once per traversal and skips the second name,
# so the directory totals 2M rather than 4M unless `-l` asks for the opposite.
#
# Written with `tr` rather than `head -c /dev/zero` alone because a hole is exactly what this
# fixture must not have: a sparse file here would report 0 and the hard-link examples would have
# nothing to count.
mkdir -p snapshots
head -c 2097152 /dev/zero | tr '\0' 'x' > snapshots/monday.tar
ln snapshots/monday.tar snapshots/tuesday.tar
chmod 644 snapshots/monday.tar
chmod 755 snapshots

# Pinned for the same reason mk_projects pins its own: the fixture block shows an `ls -l`, and an
# unpinned mtime puts today's date on the page, which is correct on the day it is captured and
# wrong the next.
touch -d "2026-06-26 10:00:00" snapshots/monday.tar snapshots
chown -R user:user snapshots 2>/dev/null || true
