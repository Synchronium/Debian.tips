#!/usr/bin/env bash
# Fixtures for content/commands/getent/examples.yaml. Must match its `fixtures:` block.
#
# Replayed as root, because the page's point about the shadow database is that the answer depends
# on who is asking: root gets a line and nobody else gets anything. Only a root replay can show
# both halves, and the unprivileged half is taken with `runuser -u user`.

set -u

. /tmp/fixtures-common.sh

# The accounts and groups every lookup on this page reads, shared with the id and managing-users
# pages so all three name the same people.
mk_accounts
mk_primary_group_account

# A host that resolves from /etc/hosts and from nowhere else.
#
# The container's own name is already in /etc/hosts, against the address Docker gave it, and that
# address is different on every run. So a page that looked up the machine it was running on would
# be documenting a number no reader could reproduce, and one that changed between two consecutive
# replays of the same page.
#
# example.com is reserved by RFC 2606 and 192.0.2.0/24 by RFC 5737, which together make this a
# name that cannot collide with a real host and an address that cannot route to one. That matters
# for more than tidiness: the page runs a lookup with `-s dns` to show the source being forced,
# and a name somebody owns could answer it.
#
# Appended only when it is missing. The restore re-runs this script before every example, and
# /etc/hosts is outside the working directory it empties, so an unconditional append would leave
# the file holding one copy per example and `getent hosts` printing all of them.
#
# Separated by spaces rather than the tab /etc/hosts is usually written with. The page shows this
# line as its sample data, and a tab there is a byte the reader cannot see and an editor is free
# to convert.
grep -q "backup.example.com" /etc/hosts || printf '192.0.2.10  backup.example.com backup\n' >> /etc/hosts
