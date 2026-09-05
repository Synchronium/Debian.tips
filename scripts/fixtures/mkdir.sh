#!/usr/bin/env bash
# Fixtures for content/commands/mkdir/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`. It documents the mode a new directory gets from
# the umask, and one example is refused for want of write permission on `/etc`. Root has that
# permission, so the refusal would not happen and the example would create a directory instead of
# teaching anything.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
