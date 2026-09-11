#!/usr/bin/env bash
# Fixtures for content/commands/dd/examples.yaml. Must match its `fixtures:` block.
#
# verify: --privileged
#
# The page writes disk images and attaches one to a loop device, which needs CAP_SYS_ADMIN.
# `mk_loop_disks` builds the two images and says why the page brings its own rather than reporting
# on the container's.
#
# Every example that copies to a file writes inside the page's working directory or to
# /srv/images, both of which are rebuilt before the next one runs.

umask 0022

. /tmp/fixtures-common.sh

mk_loop_disks
