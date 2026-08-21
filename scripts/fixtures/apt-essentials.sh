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

# Other prose pages' setups also configure apt, and `npm run replay` runs every page in one
# sandbox, so a source left behind by an earlier page changes what this one sees. Each page
# normalises the sources and preferences directories to exactly what it needs.
find /etc/apt/sources.list.d -name '*.sources' ! -name 'debian.sources' -delete 2>/dev/null
rm -f /etc/apt/preferences.d/*

# Package lists are rebuilt when the previous page left different sources configured, which
# is once per page rather than once per documented output.
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
# is printed above it whenever anything is auto-installed and unreferenced. The page then shows
# the wrong first line, with no hint that a *different* notice matched.
#
# Nothing on this page creates an orphan, which is why this went unnoticed: it takes three
# pages. /compare/remove-vs-purge-vs-autoremove/ marks cowsay auto, the dpkg page's setup purges
# cowsay-off, and cowsay is then auto with nothing depending on it. In alphabetical order the
# apt page has already marked cowsay manual by the time any of that happens, so the batch was
# green; reversing the order made it fail. Asserting the state the output depends on is the fix
# — the ordering is not something this page should have to be lucky about.
apt-get autoremove -y >/dev/null 2>&1
