#!/usr/bin/env bash
# Fixtures for content/commands/uniq/examples.yaml. Must match its `fixtures:` block.
#
# uniq only collapses *adjacent* duplicates, which is why the sorted copy is built here:
# the page's examples need both the unsorted and the sorted form of the same list.

. /tmp/fixtures-common.sh

mk_wordlist; mk_access_log; mk_users_csv; mk_report
sort wordlist.txt > wordlist-sorted.txt   # derived; the "run against a file" example uses it
