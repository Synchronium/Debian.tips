#!/usr/bin/env bash
# Fixtures for content/commands/less/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`, because one example reads `~/.bashrc` to show
# the commented-out `lesspipe` hook Debian ships. Root's `.bashrc` is a different file and does
# not carry it, so as root that example finds nothing and the page's claim goes unchecked.
# verify: --user

. /tmp/fixtures-common.sh

# Forty numbered lines: long enough that a pager is the reasonable way to read it, and short
# enough for the whole file to be listed on the page.
mk_report

# The second file, so the examples that open two at once have something to move between.
mk_access_log
