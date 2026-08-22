#!/usr/bin/env bash
# Fixtures for content/commands/systemctl/examples.yaml. Must match its `fixtures:` block.
#
# Needs a sandbox booted with systemd as PID 1; without one every example prints "System
# has not been booted with systemd as init system (PID 1). Can't operate."
# verify: --systemd
#
# Two units the examples own outright, rather than starting and stopping the system's real
# ssh or cron. Both are reset to a known state here, because this script runs before every
# example, and unit state (enabled, running, failed) otherwise leaks from one to the next.

cat > /etc/systemd/system/deploy-agent.service <<'EOF'
[Unit]
Description=Deploy agent
After=network.target

[Service]
Type=notify
ExecStart=/usr/local/bin/deploy-agent
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Exits non-zero on purpose: the page documents what a failed unit looks like, and how to
# clear it once it is fixed.
cat > /etc/systemd/system/backup-sync.service <<'EOF'
[Unit]
Description=Nightly backup sync

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup-sync
EOF

# Stands in for a real agent: runs until stopped, and handles SIGHUP as "reload your
# configuration" the way a daemon does rather than dying on it.
#
# Both halves are what make the `systemctl kill -s SIGHUP` example reproducible, and each
# fixes a different failure:
#
#   trap        `sleep` installs no SIGHUP handler, so the default disposition kills it,
#               Restart=on-failure then restarts it, and `is-active` reports whichever of
#               active/inactive/failed that race lands on. Sleeping in the background and
#               waiting is what lets the trap run at all, since a foreground `sleep infinity`
#               holds the signal until it returns, which is never.
#
#   --ready     with the default Type=simple, `systemctl start` returns once systemd has
#               forked the process, not once the process has done anything. The signal
#               then arrives before the trap is installed and kills it anyway, roughly
#               twice in ten runs. Type=notify makes `start` wait for the line below.
cat > /usr/local/bin/deploy-agent <<'EOF'
#!/bin/sh
trap 'echo "deploy-agent: reloading configuration"' HUP
systemd-notify --ready
while :; do
  sleep 3600 &
  wait $!
done
EOF

cat > /usr/local/bin/backup-sync <<'EOF'
#!/bin/sh
echo "backup-sync: cannot reach backup.example.com" >&2
exit 1
EOF

chmod 755 /usr/local/bin/deploy-agent /usr/local/bin/backup-sync

# Drop-in from an earlier example, if one left it behind.
rm -rf /etc/systemd/system/deploy-agent.service.d

systemctl daemon-reload
systemctl disable --now deploy-agent.service backup-sync.service >/dev/null 2>&1
systemctl unmask deploy-agent.service >/dev/null 2>&1
systemctl reset-failed >/dev/null 2>&1
