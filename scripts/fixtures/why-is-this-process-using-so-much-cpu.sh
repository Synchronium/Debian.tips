#!/usr/bin/env bash
# Fixtures for content/troubleshooting/why-is-this-process-using-so-much-cpu.md.
#
# Four processes, one for each way a CPU figure gets read, each under a name of its own so an
# example can pick it out with `pgrep -x`:
#
#   spinner   a copy of gawk in an empty loop, started by a script called nightly-report: the
#             runaway, busy on one core and spending all of it in its own code
#   cruncher  a copy of zstd compressing an endless stream with worker threads: busy on more than
#             one core at once
#   ddcaller  a copy of dd copying one byte at a time: busy, but mostly inside the kernel
#   indexer   a copy of python3 that ran flat out for its first two seconds and has slept since:
#             idle now, and still carrying a CPU figure from when it was busy
#
# The load average and the CPU count belong to the host (ADR-0029), so the page's block showing
# them is exempt, and these processes are what its checked examples read instead.

# Started once and left running, because a process killed here would stay behind as a zombie: PID 1
# in the container is `sleep infinity`, which never collects its children's exit status. Copied
# once too, since copying over a running binary fails with `Text file busy`.
[ -x /usr/local/bin/spinner ] || cp /usr/bin/gawk /usr/local/bin/spinner
[ -x /usr/local/bin/cruncher ] || cp /usr/bin/zstd /usr/local/bin/cruncher
[ -x /usr/local/bin/ddcaller ] || cp /usr/bin/dd /usr/local/bin/ddcaller
[ -x /usr/local/bin/indexer ] || cp "$(readlink -f /usr/bin/python3)" /usr/local/bin/indexer

# The runaway's parent is a script, so the page can show where a busy process came from.
mkdir -p /opt/tips
cat > /opt/tips/nightly-report <<'EOF'
#!/bin/sh
spinner 'BEGIN { while (1) {} }'
EOF
chmod 755 /opt/tips/nightly-report

# `setsid -f` detaches each from this script, so the script can finish while they run on.
pgrep -x spinner >/dev/null || setsid -f /opt/tips/nightly-report >/dev/null 2>&1 </dev/null
# zstd reads /dev/zero only as standard input: named on the command line, it is refused as not
# being a regular file.
pgrep -x cruncher >/dev/null || setsid -f cruncher -q -T2 -c </dev/zero >/dev/null 2>&1
pgrep -x ddcaller >/dev/null || setsid -f ddcaller if=/dev/zero of=/dev/null bs=1 >/dev/null 2>&1 </dev/null
pgrep -x indexer >/dev/null || setsid -f indexer -c '
import time
start = time.monotonic()
while time.monotonic() - start < 2:
    pass
time.sleep(1e9)
' >/dev/null 2>&1 </dev/null

# The examples compare the indexer's past against its present, so wait until its busy two seconds
# are over. On first start this is the one wait on the page; after that the loop exits at once.
for _ in $(seq 40); do
  [ "$(ps -o s= -C indexer)" = S ] && [ "$(ps -o etimes= -C indexer | tr -d ' ')" -ge 3 ] && break
  sleep 0.1
done
