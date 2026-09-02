#!/usr/bin/env bash
# Fixtures for content/commands/man/examples.yaml.
#
# This page reads the manual pages the machine already has rather than any file of its own, so
# what it needs from the sandbox is two things being true rather than a tree being built.

# `apropos`, `whatis` and `man -k` all read one index rather than the pages themselves, so a
# machine with every page installed and no index answers "nothing appropriate" to all three. The
# index is built when man-db is installed and this only rebuilds it if something has removed it,
# because `mandb` walks every page on the system and the page has examples to get on with.
if ! whatis ls >/dev/null 2>&1; then
  mandb -q >/dev/null 2>&1 || true
fi

# The page shows `man 3 printf` failing, which is true on a Debian machine until `manpages-dev` is
# installed: section 3 documents the C library, and Debian ships that separately from the tools.
# An example asserting an absence has to establish it rather than assume it.
if dpkg -s manpages-dev >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get remove -y manpages-dev >/dev/null 2>&1 || true
fi
