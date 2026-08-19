#!/usr/bin/env bash
# Fixtures for content/recipes/find-the-largest-files.md.
#
# A tree with deliberately uneven file sizes, so `du | sort -rh | head` has a stable answer.
#
# The bytes are written for real rather than with `truncate`, which is the obvious tool and the
# wrong one here: truncate creates a sparse file, and `du` reports *allocated blocks*, so a
# 2M sparse file is reported as 0 and the whole ranking the recipe teaches comes out empty.

rm -rf projects
mkdir -p projects/archive projects/logs projects/docs
head -c 2M   /dev/zero > projects/archive/backup.tar.gz
head -c 500K /dev/zero > projects/logs/app.log
head -c 64K  /dev/zero > projects/logs/access.log
head -c 8K   /dev/zero > projects/docs/notes.md
head -c 4K   /dev/zero > projects/README.md
