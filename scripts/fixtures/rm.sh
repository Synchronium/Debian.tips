#!/usr/bin/env bash
# Fixtures for content/commands/rm/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`, matching the [cp](/commands/cp/) and
# [mv](/commands/mv/) pages it shares a tree with. Root is the wrong account for most of what
# is here: it ignores the directory write bit the page spends a section on, and it is never
# prompted about a write-protected file.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
