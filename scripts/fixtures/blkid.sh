#!/usr/bin/env bash
# Fixtures for content/commands/blkid/examples.yaml. Must match its `fixtures:` block.
#
# verify: --privileged
#
# Attaching a loop device needs CAP_SYS_ADMIN. `mk_loop_disks` says why the page brings its own
# filesystem: a container's real block devices belong to the host, and `blkid` with no arguments
# would report on those rather than on anything the page made.
#
# The loop device number is never written into an example. Loop devices belong to the kernel
# rather than to the container, so which one `losetup --find` hands out depends on what else on
# the machine has one attached.

umask 0022

. /tmp/fixtures-common.sh

mk_loop_disks
