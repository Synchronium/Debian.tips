#!/usr/bin/env bash
# Fixtures for content/scripting/loops.md.

# Exactly two .txt files: the glob examples print both by name, so a third would change what
# the page claims `for f in *.txt` iterates over. No .csv, which is what makes the
# empty-glob example print nothing but "done".
echo "meeting notes" > notes.txt
echo "quarterly report" > report.txt

# The `IFS= read -r` demonstration needs a line with leading whitespace and a line with
# backslashes, because those are the two things a bare `read` destroys. Deliberately not
# .txt: it would be a third match for the `*.txt` glob the examples above iterate over.
printf '  /var/log/app.log\nC:\\temp\\file\n/srv/data\n' > paths.list
