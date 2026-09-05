#!/usr/bin/env bash
# Fixtures for content/commands/ln/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`, because it prints an owner column.
#
# `mk_site_tree` already contains one symlink, `latest.css`, and a nested `assets/` directory.
# The page needs both: an existing link for `find -type l` to count, and a subdirectory in which
# to make a link whose target resolves from somewhere other than the working directory, which is
# the mistake the page is built around.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
