#!/usr/bin/env bash
# Fixtures for content/commands/cut/examples.yaml — must match its `fixtures:` block.
#
# users2.csv is a byte-for-byte copy of users.csv: the paste example shows two files side
# by side, and the page's fixture block says so with `from:` rather than repeating it.

. /tmp/fixtures-common.sh

mk_users_csv; mk_access_log; cp users.csv users2.csv
