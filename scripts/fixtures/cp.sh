#!/usr/bin/env bash
# Fixtures for content/commands/cp/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`. It prints an owner column, and it documents
# what `cp -p` can and cannot preserve, which root would answer differently: root may give a
# file away to any owner, so the example about ownership needing privilege would succeed and
# demonstrate nothing.
# verify: --user

. /tmp/fixtures-common.sh

mk_site_tree
