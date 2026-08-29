#!/usr/bin/env bash
# Fixtures for content/scripting/where-a-script-lives.md.

# The tree sits at an absolute path outside the working directory, which is unusual here and
# deliberate. This page is about what a script prints when it is run from somewhere other than
# its own directory, so every example has to name the directory it is standing in, and the
# harness's working directory is a path no reader could recognise or reproduce.
#
# Removed before it is rebuilt, because the examples write their own scripts into this tree.
# This runs before every one of them, so each starts from an empty bin/ and tools/.
rm -rf /srv/deploy
mkdir -p /srv/deploy/tools /srv/deploy/bin

# The data file the scripts on the page go looking for. It lives beside them in tools/ rather
# than in the tree root: the whole question is how a script finds a file next to *itself* rather
# than next to whoever ran it.
printf 'retain=7\n' > /srv/deploy/tools/settings.conf
