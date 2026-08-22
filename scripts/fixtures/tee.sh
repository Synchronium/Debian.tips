#!/usr/bin/env bash
# Fixtures for content/commands/tee/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as the unprivileged `user`. Half of it is about `sudo tee`, and as root
# that demonstrates nothing: root can already write /etc, so the trick the page exists to
# teach would be indistinguishable from a plain redirect.
# verify: --user
#
# The sample data is the shared wordlist and access log, so a reader arriving from sort,
# cut or uniq meets the same files rather than new ones that happen to look similar.

. /tmp/fixtures-common.sh

mk_wordlist
mk_access_log

# The `sudo tee` examples write here, and it is outside the workdir the harness wipes between
# examples, so this page has to clean up after itself or the "create a file you do not own"
# examples would be appending to, or overwriting, a file a previous example left behind.
sudo rm -f /etc/sysctl.d/99-swappiness.conf
