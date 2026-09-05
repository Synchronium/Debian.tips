#!/usr/bin/env bash
# Fixtures for content/compare/su-vs-sudo-i-vs-sudo-s.md.
#
# verify: --user
#
# Replayed as `user`, because every difference the page draws is between an unprivileged account
# reaching for root four ways. Run as root there is nothing to reach for: `sudo` and `su` both
# start from the identity the page is asking them to change.

# The page prints the working directory each form leaves you in, and the harness's own directory
# is named after the page, so a reader would see a path nobody has. The examples `cd` here first
# and print a path that could be on any machine.
sudo mkdir -p /srv/app
sudo chmod 755 /srv/app

# root's password is locked, which is what a Debian install does when you give the first account
# sudo instead of setting a root password. The page's claim is that `su -` has nothing to
# authenticate against on such a machine, so the state has to be asserted rather than inherited
# from whatever the image happens to ship.
sudo passwd -l root >/dev/null
