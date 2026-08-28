#!/usr/bin/env bash
# Fixtures for content/commands/mv/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`, matching the [cp](/commands/cp/) and
# [rm](/commands/rm/) pages it shares a tree with. Root would answer the example about moving
# into a directory you cannot write differently, since root ignores the write bit entirely.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
