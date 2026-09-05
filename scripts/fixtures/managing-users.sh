#!/usr/bin/env bash
# Fixtures for content/commands/managing-users/examples.yaml. Must match its `fixtures:` block.
#
# Replayed as root, because every command the page documents changes the account database and
# none of them can be demonstrated without the privilege to do it. The refusals a normal account
# meets are shown with `runuser -u user` from that root shell, the way the chown page does it.
#
# Accounts are the sharpest case of state the restore does not undo. It empties the page's
# working directory and runs this script again; it knows nothing about /etc/passwd. So an example
# that creates tips-build leaves it there for every later example, and the next one to create it
# fails on a name already taken. Everything this page touches is therefore deleted here first and
# rebuilt from nothing, on every single run.
#
# UIDs and GIDs are given explicitly for the same reason. Left to pick, `useradd` takes the lowest
# free id above UID_MIN, so the numbers this page prints would depend on which examples had
# already run and in what order.

set -u

# Every account and group the page uses, whether this script creates it or an example does. A
# name that only appears in an example still belongs here: deleting it is what stops that
# example failing on its second run.
PAGE_USERS="tips-dev tips-ops tips-build tips-svc tips-renamed"
PAGE_GROUPS="tips-deploy tips-web tips-web2"

for u in $PAGE_USERS; do
  if id -u "$u" >/dev/null 2>&1; then
    deluser --remove-home "$u" >/dev/null 2>&1 || userdel -r -f "$u" >/dev/null 2>&1
  fi
  # deluser leaves the home directory when it was never created, and userdel -r reports a
  # failure for one that is missing, so neither can be trusted to have cleaned up after an
  # example that made the directory some other way.
  rm -rf "/home/$u" "/srv/$u"
done

# Each account's own group goes too, and the account names are in this list for that reason as
# well as the group names. Deleting an account does take its group with it, but `usermod -l`
# renames the account and leaves the group under the old name, so deleting the renamed account
# afterwards leaves a group called tips-dev still holding gid 1001. `adduser --uid 1001` then
# refuses, and every example after that one reports that tips-dev does not exist.
for g in $PAGE_GROUPS $PAGE_USERS; do
  if getent group "$g" >/dev/null 2>&1; then
    delgroup "$g" >/dev/null 2>&1 || groupdel -f "$g" >/dev/null 2>&1
  fi
done

# The two accounts the page starts from. `tips-dev` is an ordinary account with nothing done to
# it, so the examples that inspect an account have something plain to inspect; `tips-ops` carries
# a supplementary group, so the ones about group membership have something to show and something
# to remove.
adduser --quiet --disabled-password --gecos "Deployment account" --uid 1001 tips-dev >/dev/null 2>&1
addgroup --quiet --gid 4000 tips-deploy >/dev/null 2>&1
adduser --quiet --disabled-password --gecos "Operations account" --uid 1002 tips-ops >/dev/null 2>&1
adduser --quiet tips-ops tips-deploy >/dev/null 2>&1

# Both accounts start with a locked password, which is what `--disabled-password` leaves behind
# and what the locking examples measure against. An example that sets or unlocks a password has
# to be undone here or the one after it reports the wrong state.
passwd -q -l tips-dev >/dev/null 2>&1
passwd -q -l tips-ops >/dev/null 2>&1

# Password ageing reset to the package defaults. `chage` examples change these, and the fields
# are printed by others.
chage -m 0 -M 99999 -W 7 -I -1 -E -1 tips-dev
chage -m 0 -M 99999 -W 7 -I -1 -E -1 tips-ops
