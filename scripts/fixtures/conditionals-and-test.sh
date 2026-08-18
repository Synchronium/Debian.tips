#!/usr/bin/env bash
# Fixtures for content/scripting/conditionals-and-test.md.

# The file-test example asserts `-f exists.txt` succeeds and `! -f nope.txt` succeeds, so
# exactly one of the two may exist.
echo "present" > exists.txt
rm -f nope.txt
