#!/usr/bin/env bash
# Fixtures for content/commands/ssh/examples.yaml — must match its `fixtures:` block.
#
# Run this page with --user: ssh refuses to use a private key owned by another user, and
# the config/known_hosts examples all read ~/.ssh.
#
# ~/.ssh lives outside the working directory the harness restores, so this script manages
# it explicitly — the same situation the crontab page has with /var/spool.

rm -rf ~/.ssh
mkdir -p ~/.ssh
chmod 700 ~/.ssh

cat > ~/.ssh/config <<'EOF'
Host deb1
    HostName deb1.example.com
    User user
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
EOF
chmod 600 ~/.ssh/config

# github.com's published ed25519 host key, hashed as ssh-keygen writes it, plus an entry
# for deb1.example.com so the -R example has something of its own to remove. Host keys are
# public by definition; nothing secret is committed here.
cat > ~/.ssh/known_hosts <<'EOF'
|1|54lfM/zb+rQclYh4kZPZwbDAJXY=|0nF4Tq2N1xiwJDS540Be7ylsvKU= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
deb1.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
EOF
chmod 600 ~/.ssh/known_hosts

# A throwaway key, generated fresh every run rather than committed. Examples that would
# print its fingerprint or public half are in the .skip file for exactly this reason.
ssh-keygen -q -t ed25519 -N "" -C "user@deb1" -f ~/.ssh/id_ed25519

# A copy left world-readable, for the "refuses an unprotected key" example.
cp ~/.ssh/id_ed25519 ./id_ed25519_test
chmod 644 ./id_ed25519_test
