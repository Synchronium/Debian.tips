#!/usr/bin/env bash
# Fixtures for content/commands/touch/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`. One example is refused for want of write
# permission on `/etc`, and root has that permission, so as root it would create a file and
# demonstrate nothing.
#
# Every timestamp the page reads back comes from `mk_site_tree`, which sets all of them
# explicitly. A page about timestamps cannot take whatever the checkout happened to stamp on
# them: `-r` copies one file's time onto another and `find -newer` compares two, so both
# examples state a date the fixture has to already hold.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
