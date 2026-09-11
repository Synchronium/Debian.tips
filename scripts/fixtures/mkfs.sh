#!/usr/bin/env bash
# Fixtures for content/commands/mkfs/examples.yaml. Must match its `fixtures:` block.
#
# verify: --privileged
#
# Making a filesystem on a loop device needs CAP_SYS_ADMIN. `mk_loop_disks` says why the page
# brings its own images: a container's block devices belong to the host, and mkfs destroys what it
# is pointed at.
#
# Rebuilt from nothing before every example, which is what lets each one format `blank.img` from
# the same starting state and lets one of them overwrite the populated `data.img`.
#
# Almost every example passes `-q`. Without it mke2fs reports its progress with carriage returns
# and trailing padding, so the output depends on how the terminal redrew rather than on what the
# command did.

umask 0022

. /tmp/fixtures-common.sh

mk_loop_disks
