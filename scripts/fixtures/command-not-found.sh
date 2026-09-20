#!/usr/bin/env bash
# Fixtures for content/troubleshooting/command-not-found.md.
#
# Replayed as the unprivileged `user`. The page prints a `PATH`, contrasts it with the one sudo
# substitutes, and shows a command that root can reach and this account cannot find; root's own
# `PATH` already contains `/usr/sbin` and `/sbin`, so as root two branches have nothing to show.
# verify: --user

# `user` has passwordless sudo in the sandbox image, which is what lets an unprivileged setup
# script install the root-owned commands the page then fails to find.

# One command per branch, so no example depends on what the example before it did.

# Installed where a vendor tarball installs things, which is not on anyone's PATH. Two branches
# use it: the search that comes up empty, and the sudo search that comes up empty differently.
sudo rm -rf /opt/tips
sudo mkdir -p /opt/tips/bin
printf '#!/bin/sh\necho "deploying to staging"\n' | sudo tee /opt/tips/bin/tips-deploy >/dev/null
sudo chmod 755 /opt/tips/bin/tips-deploy

# On PATH, and moved away by one example. Rewritten every run rather than once: the example that
# demonstrates the shell's hash table moves this file, and every example after it would otherwise
# find the command already gone for a reason the page does not mean.
printf '#!/bin/sh\necho "report written"\n' | sudo tee /usr/local/bin/tips-report >/dev/null
sudo chmod 755 /usr/local/bin/tips-report

# Where that example moves it to, emptied rather than assumed empty for the same reason.
sudo rm -rf /usr/local/lib/tips
sudo mkdir -p /usr/local/lib/tips

# The page opens on a command the machine does not have, and `tree` is the stand-in. Asserted
# rather than trusted: it is a real package, so a later image that installs it would leave the
# first block on the page printing a path instead of nothing, and the page would be teaching the
# search with an answer in it.
if command -v tree >/dev/null 2>&1; then
  echo "command-not-found: tree is installed, so the page's missing command is not missing" >&2
  exit 1
fi
