#!/usr/bin/env bash
# Fixtures for content/commands/stat/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`. It reads ownership back with `%U` and `%G`, and
# one example is refused for want of search permission on a parent directory. Root has that
# permission and owns nothing here, so as root both would print something else.
#
# Every mode, owner and mtime the page prints comes from `mk_site_tree`, which sets all three
# explicitly. `stat` reports exactly what the inode holds, so a tree whose times were stamped by
# the checkout would put the moment of the checkout on the page.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
