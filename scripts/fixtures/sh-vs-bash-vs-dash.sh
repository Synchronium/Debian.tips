#!/usr/bin/env bash
# Fixtures for content/compare/sh-vs-bash-vs-dash.md.
#
# Nothing to create: every block interrogates the shells the image already has. The script
# exists to opt the page into the replay, since a prose page without one is reported as
# unverified rather than passed.
#
# Note for anyone extending this page: `bash --version` prints the build architecture
# (aarch64 here, x86_64 on a CI runner) and so can never be a documented block -- it is the
# one difference that cannot pass in both places. Nothing here prints a version at all.
#
# The paired blocks run bash first and sh second on purpose. Each is a separate process that
# exits before the next starts, so the merged stdout/stderr ordering is stable; interleaving
# the two streams *within* one command is not, which is why `source` and `.` are two blocks
# rather than one.
