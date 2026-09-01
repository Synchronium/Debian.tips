#!/usr/bin/env bash
# Fixtures for content/commands/kill/examples.yaml. Must match its `fixtures:` block.
#
# verify: --systemd
#
# The page kills processes and then counts what is left, so something has to reap what it kills.
# Under the default sandbox PID 1 is the `sleep` holding the container open, which never reaps,
# and every killed process stays in the table as a zombie carrying its own name. The counts an
# example prints would then climb with the number of examples that had already run.

# Kill by exact name, never `pkill -f tips-`. `-f` matches the whole command line, so it matches
# the shell running this script and kills the setup along with the strays.
#
# SIGKILL rather than SIGTERM, for two reasons this page creates itself. tips-stubborn ignores
# TERM, which is the point of it. And any of the three may have been left stopped by the example
# before: a stopped process holds a pending TERM until something continues it, so a TERM-based
# cleanup leaves it stopped and still on the process table, and the next example counts one worker
# too many.
for name in tips-worker tips-supervisor tips-stubborn tips-graceful; do
  pkill -9 -x "$name" 2>/dev/null || true
done

# Wait for them to go. Starting the new set while the old one is still dying gives a count that
# is 2 on a fast machine and 3 on a slow one.
for _ in $(seq 1 100); do
  pgrep -x 'tips-worker|tips-supervisor|tips-stubborn|tips-graceful' >/dev/null 2>&1 || break
  sleep 0.1
done

# A copy of a real binary rather than a script, so its `comm` and the first word of its `args`
# are the same string. tips-supervisor and tips-stubborn are scripts, whose `comm` is their own
# basename while their `args` starts with the interpreter, and that difference is what the
# `-x` and `-f` examples turn on.
cp /bin/sleep /usr/local/bin/tips-worker
chmod 755 /usr/local/bin/tips-worker

# `wait` is a builtin, so the supervisor blocks with no child of its own beyond the two workers.
# It exits when both are gone, which is what makes killing the workers and killing the group
# distinguishable: the group takes the supervisor with it, and killing the supervisor alone
# leaves the workers running under PID 1.
cat > /usr/local/bin/tips-supervisor <<'EOF'
#!/bin/bash
/usr/local/bin/tips-worker 3600 &
/usr/local/bin/tips-worker 3600 &
wait
EOF
chmod 755 /usr/local/bin/tips-supervisor

# Ignores TERM, so the page can show the one case where -9 is the answer rather than a habit.
#
# It waits on a fifo nothing writes to, rather than looping over `sleep`, because it forks
# nothing: a `sleep` loop puts a process on the system that appears and disappears several times
# a second, and any example counting processes then depends on when it ran. Opening the fifo
# read-write is what makes `read` block rather than see an immediate EOF.
rm -f /run/tips-stubborn.fifo /run/tips-graceful.fifo
mkfifo /run/tips-stubborn.fifo /run/tips-graceful.fifo
cat > /usr/local/bin/tips-stubborn <<'EOF'
#!/bin/bash
trap '' TERM
exec 3<> /run/tips-stubborn.fifo
read -r -u 3
EOF
chmod 755 /usr/local/bin/tips-stubborn

# Handles TERM rather than ignoring it, so the page can show that handling it makes no difference
# to a process that is stopped. Nothing runs until CONT, so a queued TERM waits whether it would
# reach this handler or the kernel's default action. Only KILL gets through, being applied without
# the process running at all.
cat > /usr/local/bin/tips-graceful <<'EOF'
#!/bin/bash
trap 'exit 0' TERM
exec 3<> /run/tips-graceful.fifo
read -r -u 3
EOF
chmod 755 /usr/local/bin/tips-graceful

# setsid puts the supervisor in a session of its own, so its PID is also its process group id and
# the two workers join that group. Without it the group is this setup script's, and killing the
# group would kill the harness.
#
# setpriv rather than su or runuser because setpriv execs: the other two stay resident as the
# parent, and would be a third process under `pgrep -u user`. The workers run as `user` while the
# examples run as root, which is what lets `-u user` name exactly this tree and what keeps a
# `pkill -f` narrowed by `-u` from matching the root shell running the example.
setsid setpriv --reuid=user --regid=user --init-groups /usr/local/bin/tips-supervisor \
  </dev/null >/dev/null 2>&1 &
setsid /usr/local/bin/tips-stubborn </dev/null >/dev/null 2>&1 &
setsid /usr/local/bin/tips-graceful </dev/null >/dev/null 2>&1 &

# Every process must exist before the example runs, or a counting example sees a partial tree.
for _ in $(seq 1 100); do
  [ "$(pgrep -x -c tips-worker 2>/dev/null || echo 0)" = "2" ] &&
    pgrep -x tips-stubborn >/dev/null 2>&1 &&
    pgrep -x tips-graceful >/dev/null 2>&1 && break
  sleep 0.1
done
