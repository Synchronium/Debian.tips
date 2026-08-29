#!/usr/bin/env bash
# Fixtures for content/scripting/parameter-expansion.md.

# Two .log files and one .txt. The rename loop trims `.log` from every match of `*.log` and the
# page lists the directory afterwards, so the .txt is what shows that the loop left everything
# else alone. Any further file here would appear in that listing.
printf 'GET /index.html 200\n' > access.log
printf 'GET /missing 404\n' > error.log
printf 'quarterly revenue up\n' > report.txt
