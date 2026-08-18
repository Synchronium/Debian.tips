#!/usr/bin/env bash
# Fixtures for content/debian/systemd-services.md.
#
# Needs a sandbox booted with systemd as PID 1, or none of the page's commands work.
# verify: --systemd
#
# The page documents what Debian's packaging does to a service on install, so the fixture is
# a real package that ships one. openssh-server is the page's own example.

export DEBIAN_FRONTEND=noninteractive

# The official debian images ship /usr/sbin/policy-rc.d exiting 101, which stops maintainer
# scripts starting services. The page documents that in a callout, but its main example is
# what a *real* Debian machine does, so the file is moved aside before installing and the
# container's behaviour is described rather than captured.
if [ -f /usr/sbin/policy-rc.d ]; then
  mv /usr/sbin/policy-rc.d /root/policy-rc.d.disabled
fi

if [ ! -d /var/lib/apt/lists ] || [ -z "$(ls -A /var/lib/apt/lists 2>/dev/null | grep -v lock)" ]; then
  apt-get update >/dev/null 2>&1
fi

# Installed once. Guarded because this script runs again before every documented output, and
# generating host keys on each would dominate the run.
if ! dpkg -l openssh-server 2>/dev/null | grep -q '^ii'; then
  apt-get install -y openssh-server >/dev/null 2>&1
fi

# The page's install example asserts enabled *and* active, which is the Debian convention.
# Restored explicitly: an earlier example disables the unit, and this script is what puts it
# back before the next one runs.
systemctl enable ssh >/dev/null 2>&1
systemctl start ssh >/dev/null 2>&1

# The drop-in the override examples read. `systemctl edit` would need an interactive editor,
# so the fragment is written directly and the page's edit example is exempt.
mkdir -p /etc/systemd/system/ssh.service.d
cat > /etc/systemd/system/ssh.service.d/override.conf <<'EOF'
[Service]
Restart=always
RestartSec=5
EOF
chmod 644 /etc/systemd/system/ssh.service.d/override.conf
systemctl daemon-reload
