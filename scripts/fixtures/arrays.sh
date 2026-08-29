#!/usr/bin/env bash
# Fixtures for content/scripting/arrays.md.

# Exactly two .txt files, one of them with a space in its name. The space is the whole point of
# the section that fills an array three ways: `files=( $(ls *.txt) )` reports three entries
# against `mapfile`'s two, and with two ordinary filenames both spellings would agree and the
# page would be demonstrating nothing.
#
# One line each. `wc -l` is documented on both files, and it right-aligns its counts in a column
# whose width it takes from the largest file it was given, so the contents here decide how much
# leading space the page has to show.
printf 'quarterly revenue up\n' > report.txt
printf 'ask alice about the report\n' > "notes 2026.txt"

# Nothing else matching *.txt, and nothing matching *.csv: the page states that an unmatched glob
# expands to itself, and a stray CSV here would make that claim false rather than merely unproven.
