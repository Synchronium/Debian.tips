#!/usr/bin/env bash
# Fixtures for content/troubleshooting/sudo-command-not-found.md.
#
# Creates `newbie`: a user in no groups but their own, with a password, which is exactly what
# Debian's installer leaves you with when you set a root password during installation. Every
# diagnostic and fix on the page is then run against a real account in that state.
#
# One example removes sudo outright, which is the only way to produce the error the page is named
# after. That is safe here because a page gets a container to itself (ADR-0020), and it is the
# reason for the reinstall guard at the foot of this script.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive

# Needed only so the reinstall below can find sudo.
apt_update_once

if ! id newbie >/dev/null 2>&1; then
  useradd -m -s /bin/bash newbie
fi

# A password, because sudo will not report "not in the sudoers file" until it has authenticated
# you. With `-n` it stops at the password prompt instead, which is a different message and not
# the one this page is about.
echo 'newbie:demo' | chpasswd

# Never in the sudo group at the start: the page's fix example adds them, and fixtures are
# restored by re-running this script rather than by rolling the system back.
gpasswd -d newbie sudo >/dev/null 2>&1 || true

# The sandbox image grants the `user` account passwordless sudo through /etc/sudoers.d/user.
# That is why the page uses `newbie` rather than `user`: `user` cannot demonstrate this error
# at all, and using it would have produced a page that quietly proved nothing.

# sudo back, because one example purges it and the restore between examples only empties the
# working directory. Without this, every example after that one runs on a machine that has no
# sudo to be refused by, and the page's diagnosis and fix sections stop meaning anything.
if ! dpkg -s sudo >/dev/null 2>&1; then
  apt-get install -y sudo >/dev/null 2>&1
fi
