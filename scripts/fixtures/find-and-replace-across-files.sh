#!/usr/bin/env bash
# Fixtures for content/recipes/find-and-replace-across-files.md.

# Four files, and each one is carrying a rule the page asserts.
#
#   app.conf   two matches in one file, so the page can show that `sed` replaces both and that
#              `grep -l` still lists the file once
#   db.conf    one match, the ordinary case
#   notes.txt  no match at all, which is what makes `grep -rl` worth using: the recipe's claim
#              is that an untouched file stays untouched, and nothing here would show that if
#              every file matched
#   the name with a space  the whole reason for `-Z` and `xargs -0`. The page documents the
#              unquoted pipeline failing on this file by name, so removing the space would leave
#              that example passing while demonstrating nothing.
mkdir -p config
printf 'upstream = old.example.com\nfallback = old.example.com\nport = 8080\n' > config/app.conf
printf 'host = old.example.com\nname = appdb\n' > config/db.conf
printf 'Rebuild before deploying.\n' > config/notes.txt
printf 'server_name old.example.com;\n' > "config/legacy site.conf"
