#!/usr/bin/env bash
# Fixtures for content/commands/id/examples.yaml. Must match its `fixtures:` block.
#
# Replayed as root rather than as `user`, for two reasons the page depends on. Making a setuid
# binary needs root, and the page cannot show a real uid differing from an effective one without
# one. And `usermod -aG` is what demonstrates a group the running shell has not picked up, which
# is the question most readers arrive at this page with. Where the unprivileged view is the point,
# an example drops to it with `runuser -u user`, the way the chown and managing-users pages do.

set -u

. /tmp/fixtures-common.sh

# The accounts every example reads. `mk_accounts` rebuilds them from nothing on every run, which
# is what lets one example add tips-dev to a group without the next one seeing it there.
mk_accounts
mk_primary_group_account

# A copy of `id` that runs with root's effective uid whatever account started it. Real against
# effective is the distinction `-r` exists for, and there is no way to show it without a program
# that has both: every ordinary command on the machine runs with the two equal.
#
# A copy rather than a mode change on /usr/bin/id itself, because an example that reads the
# permissions of a system binary would then be printing something no reader has.
#
# Linux ignores the setuid bit on scripts, so this has to be the real ELF binary. The page also
# prints its mode, so that is set here rather than left to a umask which belongs to the host
# rather than to the image.
cp /usr/bin/id ./id-setuid
chown root:root ./id-setuid
chmod 4755 ./id-setuid
