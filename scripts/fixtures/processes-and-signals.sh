#!/usr/bin/env bash
# Fixtures for content/concepts/processes-and-signals.md.
#
# verify: --systemd
#
# The page needs PID 1 to be systemd. Orphans are reparented to PID 1 whatever it is, but under
# the default sandbox that is the `sleep` holding the container open, and a page teaching the
# process tree would be showing a PID 1 no reader has.

umask 0022

# Two scripts that install a signal handler, because the page's subject is what a process does
# when a signal arrives and a process with no handler cannot demonstrate it. Each announces the
# signal it caught, so the examples show delivery rather than only the outcome.
#
# `while true; do sleep 0.2; done` rather than a long sleep: bash runs traps between commands,
# so a shell blocked in `sleep 300` does not act on a caught signal until that sleep returns.
# A short loop keeps the handler's response inside the fraction of a second the examples wait.
cat > stubborn.sh <<'EOF'
#!/bin/bash
trap 'echo "stubborn: caught SIGTERM, ignoring it"' TERM
while true; do sleep 0.2; done
EOF

cat > polite.sh <<'EOF'
#!/bin/bash
trap 'echo "polite: caught SIGTERM, cleaning up"; rm -f polite.lock; exit 0' TERM
touch polite.lock
while true; do sleep 0.2; done
EOF

chmod 755 stubborn.sh polite.sh

# Anything an example started and did not clean up. The restore empties the working directory
# before each example but knows nothing about processes, so a run that was interrupted, or an
# example that timed out before its own `kill`, leaves a process behind that the next example's
# `pgrep` would count.
#
# A safety net only. Each example kills what it starts, and any example that deliberately leaves
# a process running redirects its output first.
#
# That redirect is not cosmetic. **A background process inherits the harness's stdout, and the
# batch cannot finish reading until that process exits.** Leave a `sleep 300` attached to the
# pipe and the page still reports every claim as true, several minutes later.
#
# Matched narrowly on purpose. `pkill -x sleep` would be correct on a desktop and wrong here:
# systemd units in this container run sleeps of their own, and killing those changes what the
# rest of the page sees. Only the two scripts above and the exact durations the examples use.
pkill -f 'stubborn\.sh' 2>/dev/null
pkill -f 'polite\.sh' 2>/dev/null
pkill -f '^sleep 300$' 2>/dev/null
pkill -x perl 2>/dev/null
rm -f polite.lock
