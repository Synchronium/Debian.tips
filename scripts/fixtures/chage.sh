#!/usr/bin/env bash
# Fixtures for content/commands/chage/.
#
# The accounts are the ones `managing-users`, `id`, `getent` and `passwd` use, rebuilt on every run
# by `mk_accounts`, because every example here changes /etc/shadow and the restore does not touch
# it.

set -u

. /tmp/fixtures-common.sh

mk_accounts

# Every date `chage -l` prints is worked out from the last password change, which is otherwise the
# day the account was made, so the page would print whatever day the replay ran. Pinned instead,
# to the same day the passwd page uses.
chage -d 2026-09-01 tips-dev
chage -d 2026-09-01 tips-ops
