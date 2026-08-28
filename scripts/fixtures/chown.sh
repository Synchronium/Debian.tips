#!/usr/bin/env bash
# Fixtures for content/commands/chown/examples.yaml. Must match its `fixtures:` block.
#
# This page replays as root, unlike the [cp](/commands/cp/), [mv](/commands/mv/) and
# [rm](/commands/rm/) pages it shares a tree with. Changing a file's owner is a privileged
# operation, so as `user` every example that does the page's subject would fail. The examples
# about what an unprivileged account may not do run `sudo -u user` instead, which shows the
# refusal from a shell that is root's.

. /tmp/fixtures-common.sh

mk_site_tree

# A second account and a second group to hand files to. Both are given fixed ids: the page
# prints them with `ls -ln`, and an id assigned from the next free number would move whenever
# the image gains a package that adds a system user.
getent group webdev >/dev/null || groupadd -g 1500 webdev
getent passwd deploy >/dev/null || useradd -u 1500 -g webdev -M -s /usr/sbin/nologin deploy

# One example adds `user` to `webdev` to show a group change an unprivileged account is allowed
# to make. That is a change to the user database, which the per-example restore does not undo,
# and a later example on this page asserts the refusal that membership would remove. Resetting it
# here is what keeps the two independent of the order they run in.
gpasswd -d user webdev >/dev/null 2>&1 || true
