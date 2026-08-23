#!/usr/bin/env bash
# Fixtures for content/commands/head/examples.yaml. Must match its `fixtures:` block.

. /tmp/fixtures-common.sh

mk_report; mk_users_csv; mk_access_log
printf 'abcdefghij' > bytes.txt
