#!/usr/bin/env bash
# Fixtures for content/commands/fsck/examples.yaml. Must match its `fixtures:` block.
#
# verify: --privileged
#
# Attaching a loop device needs CAP_SYS_ADMIN. `mk_loop_disks` says why the page brings its own
# filesystem: fsck repairs what it is pointed at, and a container's real filesystems belong to the
# host.
#
# Rebuilt from nothing before every example, which is what lets the page corrupt the filesystem
# and leave it corrupted: the next example gets a clean one regardless.

umask 0022

. /tmp/fixtures-common.sh

mk_loop_disks
