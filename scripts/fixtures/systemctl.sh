#!/usr/bin/env bash
# Fixtures for content/commands/systemctl/examples.yaml — must match its `fixtures:` block.
#
# Needs a sandbox booted with systemd as PID 1; without one every example prints "System
# has not been booted with systemd as init system (PID 1). Can't operate."
# verify: --systemd
#
# Two units the examples own outright, rather than starting and stopping the system's real
# ssh or cron. Both are reset to a known state here, because this script runs before every
# example and unit state — enabled, running, failed — otherwise leaks from one to the next.

cat > /etc/systemd/system/deploy-agent.service <<'EOF'
[Unit]
Description=Deploy agent
After=network.target

[Service]
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

cat > /usr/local/bin/deploy-agent <<'EOF'
#!/bin/sh
# Stands in for a real agent: runs until stopped.
exec sleep infinity
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
