#!/usr/bin/env bash
# Fixtures for content/scripting/variables-and-quoting.md.

# The unquoted-glob example prints `a.txt b.txt`, so these two must be the only .txt files
# here: a third would change what the page claims `echo $pattern` expands to.
echo "first" > a.txt
echo "second" > b.txt

# The word-splitting example removes this one by the wrong name. It exists so the lesson's
# point, that the file survives only by luck, is true rather than hypothetical.
echo "archive" > "my backup.tar.gz"
