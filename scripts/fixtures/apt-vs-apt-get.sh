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
#
# This page documents apt's "WARNING: apt does not have a stable CLI interface" line, and the
# apt command page's setup installs an apt.conf that suppresses it. Under ADR-0020 that is no
# longer this page's problem: the two pages run in separate containers, so what the apt page
# configures cannot reach this one.
