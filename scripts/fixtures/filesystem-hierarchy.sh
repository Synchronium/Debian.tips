#!/usr/bin/env bash
# Fixtures for content/concepts/filesystem-hierarchy.md.
#
# The page is about where things live, so almost every block reads a path the image already has
# and this script creates very little. What it does do is put back the two things the examples
# change, both of them outside the working directory the restore empties.

set -u

# A pristine copy of the conffile the `dpkg -V` example edits, taken once and restored every run.
# Without this the second run finds the file already modified, and the example that shows dpkg
# noticing a local change has nothing to notice: it reports the modification from the run before.
PRISTINE=/srv/pristine-cron-default
if [ ! -f "$PRISTINE" ]; then
  mkdir -p /srv
  cp /etc/default/cron "$PRISTINE"
fi
cp "$PRISTINE" /etc/default/cron
chmod 644 /etc/default/cron

# Something under /usr/local for `dpkg -S` to fail to find. It has to be a real file: dpkg
# reports the same "no path found" for a path that does not exist, so a missing file would make
# the example pass while demonstrating nothing.
mkdir -p /usr/local/bin
printf '#!/bin/sh\necho "deploying"\n' > /usr/local/bin/deploy
chmod 755 /usr/local/bin/deploy
