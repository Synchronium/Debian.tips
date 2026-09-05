#!/usr/bin/env bash
# Fixtures for content/compare/which-vs-type-vs-command.md.
#
# verify: --user
#
# Nothing to create: every block asks about commands the image already has, or defines its own
# function and alias inline. The script exists to opt the page into the replay, since a prose
# page without one is reported as unverified rather than passed.
#
# Replayed as `user` because PATH is what the page is about, and root's carries the sbin
# directories that no reader's does.
#
# Note for anyone extending this page: a block defining an alias needs `shopt -s expand_aliases`
# in the same block. The replay runs each block in a non-interactive shell, where aliases are off
# by default, and `type` reports nothing for one that was never registered. At a prompt the line
# is unnecessary, which is worth saying in the prose rather than leaving a reader to copy it.
:
