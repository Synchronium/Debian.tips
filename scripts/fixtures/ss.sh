#!/usr/bin/env bash
# Fixtures for content/commands/ss/examples.yaml. Must match its `fixtures:` block.
#
# A container starts with nothing listening at all, so every socket this page prints is one this
# script created. That is what lets the page show whole-table output rather than a filtered slice
# of whatever the machine happened to be running.
#
# Each listener is a Python script with a shebang rather than a `python3 something.py` command
# line, because the kernel takes a process's name from the file it was told to execute and `ss -p`
# prints that name. The shebang has to name the interpreter directly: `#!/usr/bin/env python3`
# executes `env`, which then executes Python itself, and the name every listener ends up with is
# `python3`.

# Rebuilt only when the set is not already up. This script runs again before every example, and
# starting five Python interpreters costs more than every example on the page put together. The
# test is the sockets rather than the processes, so an example that closes one is repaired on the
# next restore instead of leaving the rest of the page to fail behind it.
sockets_ready() {
  local listening
  listening=$(ss -ltnH; ss -lunH; ss -lxH 2>/dev/null) || return 1
  grep -q '0\.0\.0\.0:8080' <<<"$listening" &&
    grep -q '127\.0\.0\.1:5432' <<<"$listening" &&
    grep -q '0\.0\.0\.0:5140' <<<"$listening" &&
    grep -q '/run/tips-cache\.sock' <<<"$listening" &&
    [ "$(ss -tnH state established '( sport = :8080 )' | wc -l)" = "1" ]
}

if sockets_ready; then
  exit 0
fi

# Kill by exact name. `pkill -f tips-` would match the shell running this script, because `-f`
# tests the whole command line rather than the process name.
for name in tips-api tips-db tips-logs tips-cache tips-client; do
  pkill -x "$name" 2>/dev/null || true
done
for _ in $(seq 1 50); do
  pgrep -x 'tips-api|tips-db|tips-logs|tips-cache|tips-client' >/dev/null 2>&1 || break
  sleep 0.1
done
rm -f /run/tips-cache.sock

# Bound to 0.0.0.0, so the page can show the difference between a service anyone can reach and
# one only this machine can. The backlog is the number `listen()` is given, and it is what a
# listening socket reports in Send-Q, so the two listeners are given different ones on purpose.
cat > /usr/local/bin/tips-api <<'PY'
#!/usr/bin/python3
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 8080))
s.listen(128)
held = []
while True:
    conn, _ = s.accept()
    held.append(conn)
PY

# Loopback only: the page's point is that the address column, not the port, says who can reach it.
cat > /usr/local/bin/tips-db <<'PY'
#!/usr/bin/python3
import socket, time
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", 5432))
s.listen(5)
while True:
    time.sleep(3600)
PY

# UDP has no states and no backlog, which is why `ss -lun` reports every one of them as UNCONN.
cat > /usr/local/bin/tips-logs <<'PY'
#!/usr/bin/python3
import socket, time
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 5140))
while True:
    time.sleep(3600)
PY

# A Unix socket, so the page can show that most of what a Debian machine listens on has no port
# at all.
cat > /usr/local/bin/tips-cache <<'PY'
#!/usr/bin/python3
import os, socket, time
os.umask(0o022)
try:
    os.unlink("/run/tips-cache.sock")
except FileNotFoundError:
    pass
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.bind("/run/tips-cache.sock")
s.listen(5)
while True:
    time.sleep(3600)
PY

# One established connection, so the page has something to show without `-l`. It holds the socket
# open rather than reconnecting, which keeps the client's ephemeral port the same for every
# example in a run.
cat > /usr/local/bin/tips-client <<'PY'
#!/usr/bin/python3
import socket, time
s = socket.create_connection(("127.0.0.1", 8080))
while True:
    time.sleep(3600)
PY

chmod 755 /usr/local/bin/tips-api /usr/local/bin/tips-db /usr/local/bin/tips-logs \
  /usr/local/bin/tips-cache /usr/local/bin/tips-client

for name in tips-api tips-db tips-logs tips-cache; do
  setsid "/usr/local/bin/$name" </dev/null >/dev/null 2>&1 &
done

# The client connects to tips-api, so it cannot start until tips-api is accepting.
for _ in $(seq 1 100); do
  ss -ltnH '( sport = :8080 )' | grep -q . && break
  sleep 0.1
done
setsid /usr/local/bin/tips-client </dev/null >/dev/null 2>&1 &

# Every socket must exist before the first example runs, or an example that prints the whole
# table sees a partial one.
for _ in $(seq 1 100); do
  sockets_ready && break
  sleep 0.1
done
