#!/usr/bin/env bash
# Fixtures for content/commands/ps/examples.yaml. Must match its `fixtures:` block.
#
# verify: --systemd
#
# The page needs PID 1 to be systemd. Under the default sandbox PID 1 is the `sleep` that
# holds the container open, so `ps -p 1` would print something no reader could ever see on a
# Debian machine, and half the page is about reading the tree above a process.
#
# Three processes are started because every selection example needs something to select that
# is not part of the boot. They run as `user` while the examples run as root, which is what
# makes `ps -u user` print exactly these three and nothing else.
#
# tips-supervisor is a script and tips-backup is a copy of a real binary, deliberately: a
# script's `comm` is its own basename while its `args` is the interpreter plus the path, which
# is the difference the `comm` and `args` examples turn on.

# Kill by exact process name, never `pkill -f tips-`. `-f` matches the whole command line, so
# it matches the shell running this script and kills the setup along with the strays.
for name in tips-supervisor tips-backup; do
  pkill -x "$name" 2>/dev/null || true
done

# Wait for them to go. Starting the new set while the old one is still dying gives a count
# that is 2 on a fast machine and 4 on a slow one.
for _ in $(seq 1 50); do
  pgrep -x tips-backup >/dev/null 2>&1 || break
  sleep 0.1
done

cp /bin/sleep /usr/local/bin/tips-backup
chmod 755 /usr/local/bin/tips-backup

# `wait` is a shell builtin, so the supervisor blocks without a child of its own. A `sleep` loop
# here would put a third process in every `-u user` listing, and killing the supervisor would
# orphan that sleep rather than take it along, so the count would depend on how recently the
# setup last ran.
cat > /usr/local/bin/tips-supervisor <<'EOF'
#!/bin/bash
/usr/local/bin/tips-backup 3600 &
/usr/local/bin/tips-backup 3600 &
wait
EOF
chmod 755 /usr/local/bin/tips-supervisor

# setsid detaches from this script's session, so the processes outlive it and are still there
# when the example runs. setpriv rather than runuser or su because setpriv execs: the other two
# stay resident as the parent, and a page that lists every command name on the system would then
# print the tool that set the fixture up.
setsid setpriv --reuid=user --regid=user --init-groups /usr/local/bin/tips-supervisor \
  </dev/null >/dev/null 2>&1 &

# Both children must exist before the example runs, or a selection example sees one of them.
for _ in $(seq 1 50); do
  [ "$(pgrep -x -c tips-backup 2>/dev/null || echo 0)" = "2" ] && break
  sleep 0.1
done
