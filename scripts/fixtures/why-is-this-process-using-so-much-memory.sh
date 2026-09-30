#!/usr/bin/env bash
# Fixtures for content/troubleshooting/why-is-this-process-using-so-much-memory.md.
#
# Three processes, one for each way a process's memory figure gets misread, each a copy of python3
# under a name of its own so an example can pick it out with `pgrep -x` or `ps -C`:
#
#   memhog  has written 200 MiB, so its resident size really is that large
#   mapper  has mapped 1 GiB and touched none of it, so its virtual size is large and its resident
#           size is not
#   sharer  wrote 100 MiB and then forked twice, so three processes each report the same 100 MiB
#           as resident, while there is only one copy of it in memory
#
# `free` and the other figures about the whole machine belong to the host (ADR-0029), so the page's
# blocks showing them are exempt, and these processes are what its checked examples read instead.

# Started once and left running, because a process killed here would stay behind as a zombie: PID 1
# in the container is `sleep infinity`, which never collects its children's exit status. Copied
# once too, since copying over a running binary fails with `Text file busy`.
python=$(readlink -f /usr/bin/python3)
for name in memhog mapper sharer; do
  [ -x "/usr/local/bin/$name" ] || cp "$python" "/usr/local/bin/$name"
done

# `setsid -f` detaches each from this script, so the script can finish while they run on.
pgrep -x memhog >/dev/null || setsid -f memhog -c '
import time
data = b"x" * (200 * 1024 * 1024)
time.sleep(1e9)
' >/dev/null 2>&1 </dev/null

pgrep -x mapper >/dev/null || setsid -f mapper -c '
import mmap, time
region = mmap.mmap(-1, 1024 ** 3)
time.sleep(1e9)
' >/dev/null 2>&1 </dev/null

pgrep -x sharer >/dev/null || setsid -f sharer -c '
import os, time
data = b"x" * (100 * 1024 * 1024)
for _ in range(2):
    if os.fork() == 0:
        break
time.sleep(1e9)
' >/dev/null 2>&1 </dev/null

# Wait until memhog holds its 200 MiB and all three sharers exist with their 100 MiB. Well under a
# second on first start, instant after that, and the loop gives up after five seconds rather than
# hanging the replay.
for _ in $(seq 50); do
  hog=$(ps -o rss= -C memhog | tr -d ' ')
  shared=$(ps -o rss= -C sharer | awk '$1 > 100000 {n++} END {print n + 0}')
  [ "${hog:-0}" -gt 204800 ] && [ "$shared" = 3 ] && pgrep -x mapper >/dev/null && break
  sleep 0.1
done
