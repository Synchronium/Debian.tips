#!/usr/bin/env bash
# Fixtures for content/debian/which-package-provides-a-file.md.
#
# The page's sample data is the machine itself, so this arranges the three states its examples
# read: a file that is installed, a file that is not, and a file that belongs to no package.
#
# Every step is guarded. This script runs again before each documented output, and a 50 MB
# index fetch and a database rebuild on each would dominate the run.

export DEBIAN_FRONTEND=noninteractive
umask 0022

STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "which-package-provides-a-file" ]; then
  apt-get update >/dev/null 2>&1
  echo which-package-provides-a-file > $STATE
fi

# apt-file, and the Contents index it searches. Installing the package is what adds those
# indices to what `apt update` fetches, so the order matters: an update before the install
# leaves nothing for apt-file to read.
if ! dpkg -s apt-file >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends apt-file >/dev/null 2>&1
fi
if ! ls /var/lib/apt/lists/*Contents-* >/dev/null 2>&1; then
  apt-file update >/dev/null 2>&1
fi

# nano, so that /usr/bin/editor exists. That symlink is created by update-alternatives rather
# than unpacked from a package, and the section about files no package owns is built on dpkg
# and apt-file both failing to account for it.
if ! dpkg -s nano >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends nano >/dev/null 2>&1
fi

# command-not-found, plus the database it consults. update-command-not-found builds that
# database out of the same Contents index apt-file reads, so it has to run after the fetch
# above; on a machine without the index it silently produces nothing to look up.
if ! dpkg -s command-not-found >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends command-not-found >/dev/null 2>&1
fi
if [ ! -s /var/lib/command-not-found/commands.db ]; then
  update-command-not-found >/dev/null 2>&1
fi

# net-tools absent. Every example contrasting "the file is here" with "the file is in the
# archive" uses ifconfig for the second case, and installing net-tools would turn the dpkg
# failures those examples show into successes.
if dpkg -s net-tools >/dev/null 2>&1; then
  apt-get purge -y net-tools >/dev/null 2>&1
fi
