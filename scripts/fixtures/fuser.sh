#!/usr/bin/env bash
# Fixtures for content/commands/fuser/examples.yaml. Must match its `fixtures:` block.
#
# verify: --privileged
#
# `fuser -m` reports on a whole filesystem, so the page needs one of its own to ask about, and
# mounting it needs CAP_SYS_ADMIN. `mk_open_files` builds it.
#
# The same processes back the lsof page. Several examples here kill one, and `mk_open_files`
# rebuilds whatever is missing on the next restore, so an example that ends a process does not
# leave the rest of the page reporting on nothing.

umask 0022

. /tmp/fixtures-common.sh

mk_open_files
