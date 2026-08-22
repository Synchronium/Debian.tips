#!/usr/bin/env bash
# Fixtures for content/commands/head/examples.yaml. Must match its `fixtures:` block.
#
# The empty log files are for the -f examples, which a batch replay can't reproduce (see
# head.skip); they exist so those commands have something to open.

. /tmp/fixtures-common.sh

mk_report; mk_users_csv; mk_wordlist; mk_access_log
printf 'abcdefghij' > bytes.txt
touch livelog.txt watch.log pidlog.txt rotlog.txt rotlog4.txt
