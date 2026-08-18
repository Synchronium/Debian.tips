#!/usr/bin/env bash
# Fixtures for content/concepts/file-permissions-explained.md.
#
# The page opens by reading nine permission bits out of an `ls -l` line, and that line names
# the owner and the group. Run as root it would read `root root`, which is not the file the
# page is describing.
# verify: --user

# Mode set explicitly: the whole first section is about reading these nine bits, so leaving
# them to the umask would make the page's opening example depend on the environment.
: > script.sh
chmod 755 script.sh

# A recent mtime rather than a fixed date. `ls -l` switches from "Jul  5 15:53" to
# "Jul  5  2026" once a file is roughly six months old, so any absolute date here is a
# green build that turns red on a specific morning months later with nothing having changed.
touch -d "$(date -d '3 days ago' '+%Y-%m-%d') 15:53" script.sh
