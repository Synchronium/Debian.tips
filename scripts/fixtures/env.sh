#!/usr/bin/env bash
# Fixtures for content/commands/env/index.md.
#
# Replayed as the unprivileged `user`, because this page prints `HOME` and `PATH` and root has
# different values for both. Replayed as root, the first example on the page is wrong.
# verify: --user

# ~/tools holds a command that is not on PATH, which is what the page's PATH examples change.
# It sits outside the working directory the harness restores, so resetting it is this script's
# job: an example that puts it on PATH for a child shell leaves nothing behind, but an example
# that edited the directory would.
#
# Not ~/bin. Debian's stock ~/.profile puts ~/bin on PATH whenever the directory exists, so a
# page that created one would be documenting a PATH that depends on which examples ran first.
rm -rf "$HOME/tools"
mkdir -p "$HOME/tools"
printf '#!/bin/sh\necho "hello from greet"\n' > "$HOME/tools/greet"
chmod 755 "$HOME/tools/greet"

# Two files for the shell to expand a pattern into. The page shows `echo $PATTERN` printing
# filenames where `printenv PATTERN` prints the pattern, and with nothing matching, the two
# commands print the same thing and the example demonstrates nothing.
printf 'Rebuild before deploying.\n' > notes.txt
printf 'Deployments this week: 4\n' > report.txt

# One word holding a character that is two bytes. `wc -m` counts characters, and which bytes
# count as one character is a decision LC_ALL makes, so a file of plain ASCII would count the
# same under every value the page sets.
printf 'h\xc3\xa9llo\n' > accents.txt

chmod 644 notes.txt report.txt accents.txt
