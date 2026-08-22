#!/usr/bin/env bash
# Fixtures for content/commands/tr/examples.yaml. Must match its `fixtures:` block.
#
# crlf.txt really does contain CRLF line endings, and the page's fixture block renders them
# visible with `from: sed "s/\r/␍/"`, since a raw CR shows as nothing at all.

. /tmp/fixtures-common.sh

mk_users_csv; printf 'line1\r\nline2\r\n' > crlf.txt
