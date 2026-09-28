#!/usr/bin/env bash
# Fixtures for content/commands/managing-users/examples.yaml. Must match its `fixtures:` block.
#
# Replayed as root, because every command the page documents changes the account database and
# none of them can be demonstrated without the privilege to do it. The refusals a normal account
# meets are shown with `runuser -u user` from that root shell, the way the chown page does it.
#
# The accounts this page starts from are `mk_accounts`, shared with the id and getent pages so
# that all three print one set of names and ids. What belongs here instead is the state this
# page's own examples create: `mk_accounts` knows nothing about those, and the per-example restore
# does not undo them, so an account one example adds is still there for the next and the one after
# it fails on a name already taken.

set -u

. /tmp/fixtures-common.sh

# Every account and group this page's examples create. Deleted here, before `mk_accounts` rebuilds
# what they were created alongside, because `usermod -l` renames an account and leaves its group
# under the old name: deleting tips-renamed afterwards would leave a group called tips-dev still
# holding gid 1001, and the `adduser --uid 1001` inside `mk_accounts` would then refuse.
for u in tips-build tips-svc tips-renamed; do
  if id -u "$u" >/dev/null 2>&1; then
    deluser --remove-home "$u" >/dev/null 2>&1 || userdel -r -f "$u" >/dev/null 2>&1
  fi
  # deluser leaves the home directory when it was never created, and userdel -r reports a
  # failure for one that is missing, so neither can be trusted to have cleaned up after an
  # example that made the directory some other way.
  rm -rf "/home/$u" "/srv/$u"
done

for g in tips-web tips-web2 tips-build tips-svc tips-renamed; do
  if getent group "$g" >/dev/null 2>&1; then
    delgroup "$g" >/dev/null 2>&1 || groupdel -f "$g" >/dev/null 2>&1
  fi
done

mk_accounts
