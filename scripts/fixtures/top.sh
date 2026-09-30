#!/usr/bin/env bash
# Fixtures for content/commands/top/.
#
# The page is about reading processes, so the fixture is three of them, each with a name of its
# own so an example can pick it out with `pgrep -x`:
#
#   spinner  a copy of gawk running an empty loop: always runnable, and all of its time is user time
#   sleeper  a copy of sleep, run as `user`: never runnable, and the only process `user` owns
#   memhog   a copy of python3 holding 200 MiB it has written to, with two idle threads
#
# Copies rather than the originals, because `top` shows a process's command name, which is the name
# of the file it was started from. Each name is at most eight characters, the width batch mode gives
# that column before it cuts a name short with a `+`.
#
# The summary lines above the process list describe the host rather than the container (ADR-0029),
# so the examples that show them are exempt, in top.skip.

# Started once and left running for the rest of the page, rather than restarted before every
# example. A process the setup script killed would stay behind as a zombie, because PID 1 in the
# container is `sleep infinity`, which never collects its children's exit status, and `pgrep -x`
# would then find the dead process as well as its replacement.
#
# Copied once, too: copying over a binary a process is running fails with `Text file busy`.
[ -x /usr/local/bin/spinner ] || cp /usr/bin/gawk /usr/local/bin/spinner
[ -x /usr/local/bin/sleeper ] || cp /usr/bin/sleep /usr/local/bin/sleeper
[ -x /usr/local/bin/memhog ] || cp "$(readlink -f /usr/bin/python3)" /usr/local/bin/memhog

# `setsid -f` detaches each one from this script, so the script can finish while they run on. The
# sleeper runs as `user` through `setpriv`, which replaces itself with the program rather than
# staying behind as its parent, as `runuser` would.
pgrep -x spinner >/dev/null || setsid -f spinner 'BEGIN { while (1) {} }' >/dev/null 2>&1 </dev/null
pgrep -x sleeper >/dev/null ||
  setsid -f setpriv --reuid=user --regid=user --init-groups sleeper infinity >/dev/null 2>&1 </dev/null
pgrep -x memhog >/dev/null || setsid -f memhog -c '
import threading, time
data = b"x" * (200 * 1024 * 1024)
for _ in range(2):
    threading.Thread(target=time.sleep, args=(1e9,), daemon=True).start()
time.sleep(1e9)
' >/dev/null 2>&1 </dev/null

# No example may renice them. Raising a priority back needs `CAP_SYS_NICE`, which the container is
# not given, so a change could not be undone here, and every example after it would see it.

# The examples read memhog's memory and threads, so wait until it holds all 200 MiB and has both
# threads. Well under a second on first start, instant after that, and the loop gives up after
# three seconds rather than hanging the replay.
for _ in $(seq 30); do
  pid=$(pgrep -x memhog)
  rss=$(awk '/^VmRSS:/ {print $2}' "/proc/$pid/status" 2>/dev/null)
  [ "${rss:-0}" -gt 204800 ] && [ "$(ps -o nlwp= -p "$pid" | tr -d ' ')" = 3 ] && break
  sleep 0.1
done
