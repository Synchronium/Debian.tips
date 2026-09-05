#!/usr/bin/env bash
# Fixtures for content/commands/cd/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`. It prints the basename of `$HOME`, which is
# `user` for a normal account and `root` for root, and one example is refused for want of
# execute permission on a directory, which root would enter regardless.
#
# `depot/` exists so that a symlink can have a real parent whose name differs from the name it
# was reached through. That is the only way `cd ..` and `cd -P ..` can be shown answering
# differently, and both answers have to be names the page can print.
#
# Nothing here may print the working directory itself. The harness names it after the page, so
# a bare `pwd` would put a path into the output that no reader could ever see. Every example
# either stands in a fixed system directory or prints a basename below the working directory.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree

mkdir -p depot/inner
ln -s ../depot/inner site/shortcut
chmod 755 depot depot/inner

# Set explicitly for the same reason `mk_site_tree` sets its own: a directory created by this
# script carries the moment the container was built, and the `fixtures:` block prints a listing.
touch -d "2026-06-15 10:00:00" depot depot/inner
touch -h -d "2026-06-18 09:00:00" site/shortcut
