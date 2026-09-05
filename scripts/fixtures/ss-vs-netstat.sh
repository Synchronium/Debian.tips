#!/usr/bin/env bash
# Fixtures for content/compare/ss-vs-netstat.md.
#
# A container listens on nothing, so both commands would print an empty table and the page would
# be comparing two blanks. Two listeners are started here, one reachable from anywhere and one
# only from this machine, because the address column is where the two tools agree and the page
# needs them to be showing the same thing before it can show where they differ.
#
# `net-tools` is installed here rather than by an example. A page whose first example installed
# it would be demonstrating its own absence and then removing the evidence for every block after
# that one. What the page claims instead is which package each command comes from, which `dpkg -S`
# answers and which stays true whether or not this script has run.
#
# Every block filters to one port. Which listening socket a kernel reports first is settled per
# network namespace and cannot be pinned from here (ADR-0026), and a prose page has no way to say
# that the order of its lines is not part of the claim.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive

if ! command -v netstat >/dev/null 2>&1; then
  apt_update_once
  apt-get install -y net-tools >/dev/null 2>&1
fi
if ! command -v netstat >/dev/null 2>&1; then
  echo "ss-vs-netstat: net-tools did not install, so half the page has nothing to compare" >&2
  exit 1
fi

# Rebuilt only when the sockets are not already up, since this runs again before every block and
# starting two Python interpreters costs more than the blocks do. The test is the sockets rather
# than the processes, so a block that closes one is repaired on the next restore.
sockets_ready() {
  local listening
  listening=$(ss -ltnH) || return 1
  grep -q '0\.0\.0\.0:8080' <<<"$listening" && grep -q '127\.0\.0\.1:5432' <<<"$listening"
}

if sockets_ready; then
  exit 0
fi

# Killed by exact name. `pkill -f tips-` would match the shell running this script, because `-f`
# tests the whole command line.
for name in tips-api tips-db; do
  pkill -x "$name" 2>/dev/null || true
done

# The shebang names the interpreter directly. A process is named after the file the kernel was
# told to execute, so going through `env` would leave both listeners called `python3` and neither
# tool could say which one holds which port.
cat > /usr/local/bin/tips-api <<'PY'
#!/usr/bin/python3
import socket, time
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 8080))
s.listen(128)
while True:
    time.sleep(3600)
PY

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

chmod 755 /usr/local/bin/tips-api /usr/local/bin/tips-db

for name in tips-api tips-db; do
  setsid "/usr/local/bin/$name" </dev/null >/dev/null 2>&1 &
done

# Both sockets must exist before the first block runs, or a block printing the whole table sees a
# partial one.
for _ in $(seq 1 100); do
  sockets_ready && break
  sleep 0.1
done
