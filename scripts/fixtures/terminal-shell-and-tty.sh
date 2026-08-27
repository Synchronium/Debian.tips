#!/usr/bin/env bash
# Fixtures for content/concepts/terminal-shell-and-tty.md.
#
# Nothing to create: every block interrogates the terminal the block is running under, and
# there is no sample data a page about device files could have. The script exists to opt the
# page into the replay, since a prose page without one is reported as unverified rather than
# passed.
#
# Note for anyone extending this page. The harness gives an example no terminal. A block that
# needs one wraps its command in `script -qec '...' /dev/null`, which allocates a pseudo-terminal
# and runs the command under it. Both states are therefore available, deliberately, and the page
# compares them.
#
# Two limits on that come with it.
#
# The device is always /dev/pts/0, because examples run one at a time and each `script` frees the
# pty before the next starts. Background a second `script` and it takes pts/1, at which point the
# number depends on ordering.
#
# `stty size` reports `0 0`, because nothing sets a window size on that pty. No block can depend
# on the terminal's width. `tput cols` fails for the same reason.
