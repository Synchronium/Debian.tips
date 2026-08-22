#!/usr/bin/env bash
# Fixtures for content/recipes/bulk-rename-files.md.
#
# Three uppercase-extension photos for the rename loop, and two files with spaces in their
# names for the preview variation. The spaces are the point, since an unquoted "$f" is what
# the recipe warns about.

: > IMG_0001.JPG
: > IMG_0002.JPG
: > IMG_0003.JPG
: > "q1 report.txt"
: > "q2 report.txt"
