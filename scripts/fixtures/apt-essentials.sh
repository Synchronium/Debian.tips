#!/usr/bin/env bash
# Fixtures for content/debian/apt-essentials.md.
#
# The page's outputs are package states rather than files, so this puts the sandbox into the
# states it documents: nano removed-but-not-purged (the `rc` state), ripgrep absent so
# --simulate has something to plan, curl present so dpkg can be asked about it.
#
# Every step is guarded. This script runs again before each documented output, and an
# unguarded apt-get install would spend a few seconds per block re-doing settled work.

export DEBIAN_FRONTEND=noninteractive

# Package lists are fetched once per container rather than once per documented output, which is
# what this marker is for: the script runs before every one of them.
STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "apt-essentials" ]; then
  apt-get update >/dev/null 2>&1
  echo apt-essentials > $STATE
fi

# nano in the `rc` state: binaries gone, configuration still on disk. Installing then
# removing (not purging) is the only way to reach it.
if ! dpkg -l nano 2>/dev/null | grep -q '^rc'; then
  apt-get install -y nano >/dev/null 2>&1
  apt-get remove -y nano >/dev/null 2>&1
fi

# ripgrep absent, so `--simulate` plans an install rather than reporting nothing to do.
if dpkg -l ripgrep 2>/dev/null | grep -q '^ii'; then
  apt-get purge -y ripgrep >/dev/null 2>&1
fi

# curl present, for the "which package owns this file" example.
if ! dpkg -l curl 2>/dev/null | grep -q '^ii'; then
  apt-get install -y curl >/dev/null 2>&1
fi

# Nothing orphaned. The --simulate example greps for `^The following`, and apt has two notices
# starting that way: "The following NEW packages will be installed" is the one the page
# documents, and "The following package was automatically installed and is no longer required"
# is printed above it whenever anything is auto-installed and unreferenced. The page would then
# show the wrong first line, with no hint that a different notice had matched.
#
# Removing nano above is enough to orphan something it pulled in, and this script runs before
# every block, so the state has to be asserted here rather than assumed from a fresh container.
apt-get autoremove -y >/dev/null 2>&1
