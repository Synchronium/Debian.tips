#!/usr/bin/env bash
# Fixtures for content/compare/apt-vs-apt-get.md.
#
# Nothing to create: every block queries the installed apt itself. The script exists to opt
# the page into the replay, since a prose page without one is reported as unverified rather
# than passed.
#
# Note for anyone extending this page: no block here may print a package version or an
# architecture. `apt-cache policy` and `apt --version` both do, and an architecture is the
# one thing that cannot pass in both places (arm64 locally, amd64 on the runner). The two
# --help greps and the CLI warning were chosen because their text carries neither.

# The apt command page's setup installs an apt.conf that suppresses "WARNING: apt does not
# have a stable CLI interface", because every one of its examples would otherwise carry a line
# no reader sees. This page documents that warning, so it has to undo that; `npm run replay`
# runs every page in one sandbox, and whichever ran last would otherwise decide the result.
# Caught exactly this way: 4/4 alone, failing in the batch.
rm -f /etc/apt/apt.conf.d/99-replay-no-script-warning
