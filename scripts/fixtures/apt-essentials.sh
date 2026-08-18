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

# Package lists, fetched once. Without them apt has nothing to plan an install from.
if [ ! -d /var/lib/apt/lists ] || [ -z "$(ls -A /var/lib/apt/lists 2>/dev/null | grep -v lock)" ]; then
  apt-get update >/dev/null 2>&1
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
