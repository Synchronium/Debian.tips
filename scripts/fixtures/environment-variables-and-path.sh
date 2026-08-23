#!/usr/bin/env bash
# Fixtures for content/concepts/environment-variables-and-path.md.
#
# Nothing to create: every example builds the file it needs, because the page is about what a
# process inherits rather than about files on disk.
#
# ~/bin is removed rather than created. The harness restores its own working directory before
# each example, and that directory sits *inside* $HOME, so anything an example writes to ~ is
# left standing. Several examples here create ~/bin, and Debian's ~/.profile adds ~/bin to PATH
# whenever it exists, so without this line the login-shell example prints a different PATH
# depending on which examples ran before it, and every later page inherits the directory.
rm -rf "$HOME/bin"
#
# PATH is different for root and for an unprivileged user, and the page shows both a user's PATH
# and what sudo substitutes for it. Replayed as root, every one of those blocks is wrong.
# verify: --user
