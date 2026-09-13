#!/usr/bin/env bash
# Fixtures for content/troubleshooting/service-wont-start.md.
#
# verify: --systemd
#
# A unit per failure, each reset here because this script runs before every example. Unit state
# belongs to the machine rather than to the working directory the restore empties, so a unit left
# failed, masked or running is still in that state for the next example on the page.
#
# One unit per failure rather than one unit reconfigured between examples. The states are then
# independent of each other and of the order the page happens to visit them in, and a reader can
# match every unit name on the page to the block below that breaks it.

umask 0022

id tipssvc >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin tipssvc

# Stop and unmask everything from the previous example before rewriting it. `reset-failed` clears
# the failed state as well as the unit's recorded exit status, which `systemctl status` and
# `list-units --failed` both read.
units="tips-api tips-worker tips-report tips-gateway tips-listener tips-quiet tips-legacy"
for u in $units; do
  systemctl unmask "$u.service" >/dev/null 2>&1 || true
  systemctl stop "$u.service" >/dev/null 2>&1 || true
  systemctl disable "$u.service" >/dev/null 2>&1 || true
  systemctl reset-failed "$u.service" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/$u.service" "/usr/lib/systemd/system/$u.service"
done

# Never created. The page's first branch is the unit that does not exist, and it is named here so
# a reader who greps this script for a unit name finds every one the page mentions.
rm -f /etc/systemd/system/tips-typo.service

mkdir -p /srv/tips

# 203/EXEC: the unit file is valid and the program it names is absent. Deliberately not created.
rm -f /usr/local/bin/tips-api
cat > /etc/systemd/system/tips-api.service <<'EOF'
[Unit]
Description=Tips API

[Service]
ExecStart=/usr/local/bin/tips-api
EOF

# 1/FAILURE: the program runs, complains to stderr and exits non-zero. The message on stderr is
# what makes `journalctl -u` worth reading rather than `systemctl status` alone.
cat > /usr/local/bin/tips-worker <<'EOF'
#!/bin/sh
echo "tips-worker: cannot open /etc/tips/worker.conf: No such file or directory" >&2
exit 1
EOF
chmod 755 /usr/local/bin/tips-worker
rm -f /etc/tips/worker.conf
cat > /etc/systemd/system/tips-worker.service <<'EOF'
[Unit]
Description=Tips worker

[Service]
Type=notify
ExecStart=/usr/local/bin/tips-worker
EOF

# 200/CHDIR: the unit is refused before its program runs, because `tipssvc` cannot enter the
# directory `WorkingDirectory=` names. Mode 700 owned by root is what makes that true, so the
# mode is set explicitly rather than left to the umask.
mkdir -p /srv/tips/reports
chown root:root /srv/tips/reports
chmod 700 /srv/tips/reports
cat > /usr/local/bin/tips-report <<'EOF'
#!/bin/sh
exec sleep 300
EOF
chmod 755 /usr/local/bin/tips-report
cat > /etc/systemd/system/tips-report.service <<'EOF'
[Unit]
Description=Tips report builder

[Service]
Type=notify
User=tipssvc
WorkingDirectory=/srv/tips/reports
ExecStart=/usr/local/bin/tips-report
EOF

# The program behind both the port holder and the unit that wants the same port. Its bind failure
# is caught and reported in one line, the way a daemon written for the job would report it.
# Letting Python raise instead puts a traceback through several standard-library files into the
# journal, so the page would be teaching the reader to read Python rather than systemd.
cat > /usr/local/bin/tips-serve <<'EOF'
#!/usr/bin/python3
import http.server
import socketserver
import sys

port = int(sys.argv[1])
socketserver.TCPServer.allow_reuse_address = False
try:
    server = socketserver.TCPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
except OSError as err:
    print(f"tips-serve: cannot bind 127.0.0.1:{port}: {err.strerror}", file=sys.stderr)
    sys.exit(1)
with server as httpd:
    httpd.serve_forever()
EOF
chmod 755 /usr/local/bin/tips-serve
# The holder is started at the end of this script, so `tips-listener` has a port to collide with
# in every example.
cat > /etc/systemd/system/tips-gateway.service <<'EOF'
[Unit]
Description=Tips gateway

[Service]
ExecStart=/usr/local/bin/tips-serve 9101
EOF
cat > /etc/systemd/system/tips-listener.service <<'EOF'
[Unit]
Description=Tips listener

[Service]
Type=notify
ExecStart=/usr/local/bin/tips-serve 9101
EOF

# Starts, stays up, and never binds a socket. The unit the page ends on, because `systemctl` calls
# it active and the reader's own client still cannot connect.
cat > /usr/local/bin/tips-quiet <<'EOF'
#!/bin/sh
exec sleep 300
EOF
chmod 755 /usr/local/bin/tips-quiet
cat > /etc/systemd/system/tips-quiet.service <<'EOF'
[Unit]
Description=Tips quiet service

[Service]
ExecStart=/usr/local/bin/tips-quiet
EOF

# Masked. The unit file goes in /usr/lib/systemd/system rather than beside the others, because
# masking works by putting a symlink to /dev/null in /etc/systemd/system: a unit whose own file is
# already there cannot be masked, and `systemctl mask` says so.
cat > /usr/lib/systemd/system/tips-legacy.service <<'EOF'
[Unit]
Description=Tips legacy collector

[Service]
ExecStart=/bin/true
EOF

systemctl daemon-reload
systemctl mask tips-legacy.service >/dev/null 2>&1

# Wait for the socket rather than for the unit. `systemctl start` on a `Type=simple` unit returns
# once the process is forked, which is before Python has bound anything, and the whole point of
# `tips-gateway` is that the port is already taken by the time an example runs.
systemctl start tips-gateway.service
for _ in $(seq 50); do
  ss -ltn 'sport = :9101' | grep -q LISTEN && break
  sleep 0.1
done
