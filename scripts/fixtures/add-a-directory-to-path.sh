#!/usr/bin/env bash
# Fixtures for content/recipes/add-a-directory-to-path.md.
#
# Replayed as the unprivileged `user`. Root's `$HOME` is `/root`, which Debian gives a different
# `.profile` without the two `if [ -d ]` blocks this page is about, so as root every example here
# would be answering a question about a file that is not there.
# verify: --user

# Everything this page touches lives in $HOME rather than in the working directory, and the
# harness only restores the working directory. So the reset is this script's job: without it, the
# example that shows a tool missing from PATH would find one an earlier example had installed.
rm -rf "$HOME/.local" "$HOME/bin" "$HOME/scripts"

# Debian's stock file, back from the skeleton every account is created from. The page quotes its
# last nine lines, and one example appends to it.
cp /etc/skel/.profile "$HOME/.profile"
