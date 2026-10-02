#!/usr/bin/env bash
# Fixtures for content/commands/passwd/.
#
# The accounts are the ones `managing-users`, `id`, `getent` and `chage` use, rebuilt on every run
# by `mk_accounts`, because an example that sets, locks or expires a password changes the account
# database for every example after it, and the restore does not touch /etc/shadow.

set -u

. /tmp/fixtures-common.sh

mk_accounts

# The last password change is the day the account was made, so left alone `passwd -S` and every
# date derived from it would print whatever day the replay ran. Pinned to a fixed day instead.
chage -d 2026-09-01 tips-dev
chage -d 2026-09-01 tips-ops

# An SSH server on the loopback address, so the page can show which kinds of lock stop a login and
# which do not. A locked password is the case that matters: it does not stop a key, and the only
# way to show that is to log in with one.
#
# Started once and left running, like every long-lived process a fixture starts, because a killed
# one would stay behind as a zombie under the container's `sleep infinity`. Port 2222 rather than
# 22, so nothing about it depends on what else might be listening.
mkdir -p /run/sshd
[ -f /etc/ssh/ssh_host_ed25519_key ] || ssh-keygen -A >/dev/null
pgrep -x sshd >/dev/null || /usr/sbin/sshd -p 2222 -o ListenAddress=127.0.0.1

# Root's key, and a config entry naming the server, so an example reads `ssh tips-server` rather
# than a line of options. The host key goes into known_hosts here, because otherwise `ssh` prints
# a warning about adding it, and that warning would be part of every example's output.
mkdir -p /root/.ssh
chmod 700 /root/.ssh
[ -f /root/.ssh/tips-key ] || ssh-keygen -q -t ed25519 -N "" -C "root@deb1" -f /root/.ssh/tips-key
cat > /root/.ssh/config <<'EOF'
Host tips-server
    HostName 127.0.0.1
    Port 2222
    User tips-dev
    IdentityFile ~/.ssh/tips-key
    BatchMode yes
EOF
chmod 600 /root/.ssh/config
for _ in $(seq 20); do
  keys=$(ssh-keyscan -q -p 2222 -t ed25519 127.0.0.1 2>/dev/null) && [ -n "$keys" ] && break
  sleep 0.1
done
printf '%s\n' "$keys" > /root/.ssh/known_hosts

# tips-dev's home is rebuilt with the account, so its authorized_keys is put back every run.
install -d -m 700 -o tips-dev -g tips-dev /home/tips-dev/.ssh
install -m 600 -o tips-dev -g tips-dev /root/.ssh/tips-key.pub /home/tips-dev/.ssh/authorized_keys
