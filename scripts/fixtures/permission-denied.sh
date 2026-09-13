#!/usr/bin/env bash
# Fixtures for content/troubleshooting/permission-denied.md.
#
# Replayed as the unprivileged `user`, because root is refused none of this: every example would
# succeed, and a page about a denial would have reproduced no denial at all.
#
# The noexec mount at the end is why the page also asks for a privileged sandbox.
# verify: --user --privileged

umask 0022

# `user` has passwordless sudo in the sandbox image, which is what lets a script running as the
# unprivileged account build the root-owned objects the page is refused access to.
#
# Unmounted before the tree goes, or `rm -rf` stops at the mount point with "Device or resource
# busy" and leaves half the fixtures standing.
mountpoint -q /srv/tips/scratch && sudo umount /srv/tips/scratch
sudo rm -rf /srv/tips
sudo mkdir -p /srv/tips

# One object per branch, so any example can be read on its own and none of them depends on what
# the example before it did.

# Refused because the mode says so, which is the case the page opens on.
printf 'TOKEN=hunter2\n' | sudo tee /srv/tips/secrets.env >/dev/null
sudo chmod 600 /srv/tips/secrets.env

# Readable by anyone, writable by root alone: the file the page's write and sudo branches use.
printf 'workers 4\n' | sudo tee /srv/tips/app.conf >/dev/null
sudo chmod 644 /srv/tips/app.conf

# A script with no execute bit for anyone. The page contrasts it with the one under the noexec
# mount below, where the bit is set and the kernel refuses anyway.
printf '#!/bin/sh\necho backing up\n' | sudo tee /srv/tips/backup.sh >/dev/null
sudo chmod 644 /srv/tips/backup.sh

# A readable file inside a directory that cannot be traversed. The file's own mode grants
# everything and the account owns it, so the only thing refusing is the `x` bit on the parent.
sudo mkdir -p /srv/tips/private
printf 'nothing secret\n' | sudo tee /srv/tips/private/notes.txt >/dev/null
sudo chown user:user /srv/tips/private/notes.txt
sudo chmod 644 /srv/tips/private/notes.txt
sudo chmod 750 /srv/tips/private

# Group-owned by a group the account is not in. Removed from the group rather than assumed
# absent: one example adds itself to it, and that write survives into /etc/group.
sudo groupadd -f tipsdata
sudo gpasswd -d user tipsdata >/dev/null 2>&1 || true
sudo mkdir -p /srv/tips/reports
printf 'week,total\n' | sudo tee /srv/tips/reports/summary.csv >/dev/null
sudo chown root:tipsdata /srv/tips/reports/summary.csv
sudo chmod 640 /srv/tips/reports/summary.csv

# Owned by the account running the examples, and unreadable to it: the owner's own bits are
# checked and the group's are never consulted, though the account is in that group too.
printf 'draft\n' | sudo tee /srv/tips/draft.txt >/dev/null
sudo chown user:user /srv/tips/draft.txt
sudo chmod 060 /srv/tips/draft.txt

# The account a page example checks the config against, standing in for the www-data or
# postgres a service really runs as. `--system` keeps it out of the ordinary uid range and
# gives it no home directory to create.
id tipssvc >/dev/null 2>&1 || sudo useradd --system --shell /usr/sbin/nologin tipssvc

# A world-writable directory with the sticky bit, holding somebody else's file. Its own, rather
# than /tmp: the harness keeps files in /tmp, and a page example deleting one of them would be
# reaching outside its own fixtures.
sudo mkdir -p /srv/tips/shared
sudo chmod 1777 /srv/tips/shared
printf 'theirs\n' | sudo tee /srv/tips/shared/report.log >/dev/null
sudo chown tipssvc:tipssvc /srv/tips/shared/report.log

# An executable file on a filesystem mounted `noexec`, which refuses it with the same errno the
# missing execute bit produces.
sudo mkdir -p /srv/tips/scratch
sudo mount -t tmpfs -o noexec,size=1M tmpfs /srv/tips/scratch
sudo chown user:user /srv/tips/scratch
sudo chmod 755 /srv/tips/scratch
printf '#!/bin/sh\necho ran\n' > /srv/tips/scratch/run.sh
chmod 755 /srv/tips/scratch/run.sh
