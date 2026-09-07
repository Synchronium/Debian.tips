#!/usr/bin/env bash
# Fixtures for content/commands/date/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`, for one example: setting the system clock is
# refused without CAP_SYS_TIME, and that refusal is what the page shows. As root the same command
# either succeeds or fails for a reason the reader does not share.
#
# `date -r` reads a file's modification time, so the two files it names have to carry times the
# page can state. `mk_site_tree` sets every one of them explicitly.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
