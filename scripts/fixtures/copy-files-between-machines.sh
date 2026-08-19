#!/usr/bin/env bash
# Fixtures for content/recipes/copy-files-between-machines.md.
#
# The only page on the site that needs a working SSH *server* rather than just the client: scp
# and rsync are the subject, and neither says anything useful without a peer to talk to. The
# ssh page gets away with `ssh -G` and `ssh-keygen`, which never open a connection.
#
# Replays as `user`, because the paths in the documented output are /home/user's.
# verify: --user

# sshd, started once and left running. Host keys are generated on first boot only; regenerating
# them every example would invalidate known_hosts and turn every transfer into a prompt.
if ! ss -ltn 'sport = :22' | grep -q ':22'; then
  sudo ssh-keygen -A >/dev/null 2>&1
  sudo mkdir -p /run/sshd
  sudo /usr/sbin/sshd
  for _ in $(seq 1 40); do
    ss -ltn 'sport = :22' | grep -q ':22' && break
    sleep 0.1
  done
fi

# A key, authorised against this same host, and a `deb1` alias for it. The recipe is written
# around a host alias rather than a raw hostname, so the fixture has to provide one or the
# documented command is not the command being run.
rm -rf ~/.ssh
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -q -t ed25519 -N "" -C "user@deb1" -f ~/.ssh/id_ed25519
cp ~/.ssh/id_ed25519.pub ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat > ~/.ssh/config <<'CFG'
Host deb1
    HostName 127.0.0.1
    User user
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR
CFG
chmod 600 ~/.ssh/config

# 127.0.0.1 rather than localhost, and LogLevel ERROR above, for the same reason the curl and
# wget pages name an address: what localhost resolves to belongs to the reader's machine, and
# the host-key banner would otherwise be output nobody else reproduces.

# The destinations are absolute paths in the home directory, because that is what the recipe
# documents a remote host looking like. They sit outside the working directory the harness
# wipes between examples, so this script owns their lifecycle the same way it owns ~/.ssh --
# without the reset, the second run of the rsync example would report nothing to send.
rm -rf project ~/project ~/backups
mkdir -p project ~/backups ~/project
printf 'quarterly summary\n' > project/a.txt
printf 'stub pdf\n' > report.pdf
