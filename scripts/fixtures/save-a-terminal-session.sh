#!/usr/bin/env bash
# Fixtures for content/recipes/save-a-terminal-session.md.
#
# One small file, so the recipe has something to run a command against whose output is short
# enough to show twice: once on screen and once out of the file `tee` wrote.
#
# Everything else the page makes is written into the working directory, which the restore empties
# before every block, so the typescripts and logs do not accumulate between them.

printf 'one\ntwo\n' > data.txt
chmod 644 data.txt
