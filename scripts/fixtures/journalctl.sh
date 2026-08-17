#!/usr/bin/env bash
# Fixtures for content/commands/journalctl/examples.yaml — must match its `fixtures:` block.
#
# Needs a sandbox booted with systemd as PID 1, or there is no journal to read.
# verify: --systemd
#
# The journal is emptied first, because this script runs before every example and the
# journal is append-only: without it, three runs of the setup leave three copies of every
# entry and an example asking for the last three gets the same line repeated. Rotating
# retires the active file and vacuuming discards the archived ones, which takes ~50ms.

journalctl --rotate --quiet 2>/dev/null
journalctl --vacuum-size=1K --quiet 2>/dev/null

# A unit whose logs the -u examples read. It writes a few lines and then fails, which is
# what makes it worth looking at in a journal.
cat > /etc/systemd/system/backup-sync.service <<'EOF'
[Unit]
Description=Nightly backup sync

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup-sync
EOF

cat > /usr/local/bin/backup-sync <<'EOF'
#!/bin/sh
echo "starting backup of /srv/data"
echo "connecting to backup.example.com"
echo "cannot reach backup.example.com: connection refused" >&2
exit 1
EOF
chmod 755 /usr/local/bin/backup-sync
# Set explicitly, never left to the umask: a world-writable unit file makes systemd log a
# warning on every reload, which would land in the middle of the examples' output.
chmod 644 /etc/systemd/system/backup-sync.service

systemctl daemon-reload
systemctl reset-failed backup-sync.service >/dev/null 2>&1
systemctl start backup-sync.service >/dev/null 2>&1 || true

# Entries with a known tag and known priorities, for the -t and -p examples. systemd-cat
# tags them the way a program logging through the journal would.
echo "deploy 4a91c2 finished in 4.2s" | systemd-cat -t deploy-agent -p info
echo "retrying upload, attempt 2 of 3" | systemd-cat -t deploy-agent -p warning
echo "upload failed: no space left on device" | systemd-cat -t deploy-agent -p err

# journald writes asynchronously, so an example can read the journal before the lines above
# have landed in it. Waiting for them to appear rather than sleeping a fixed interval: under
# load a fixed wait is either too short, which fails the page intermittently, or too long,
# which it pays on every one of the examples.
# Both halves have to have landed: the three tagged entries, and systemd's own account of
# backup-sync failing, whose last line is "Failed to start". An example counting errors by
# unit sees a different number depending on how much of the latter has arrived.
for _ in $(seq 1 100); do
  tagged=$(journalctl -t deploy-agent -n 3 --no-pager -o cat 2>/dev/null | wc -l)
  if [ "$tagged" = 3 ] && journalctl -u backup-sync --no-pager -o cat 2>/dev/null | grep -q "^Failed to start"; then
    break
  fi
  sleep 0.05
done
