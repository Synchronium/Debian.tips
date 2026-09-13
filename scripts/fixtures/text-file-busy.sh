#!/usr/bin/env bash
# Fixtures for content/troubleshooting/text-file-busy.md.
#
# verify: --systemd
#
# The page kills nothing, but this script does: every example may have renamed, deleted or
# replaced the files below, so all of it is rebuilt before the next one runs. Under the default
# sandbox pid 1 is the `sleep` holding the container open and reaps nothing, so each rebuild would
# leave another process named `tips-agent` in the table and `pgrep -x` would stop naming one pid.
# systemd as pid 1 reaps them.
#
# Nothing here prints a size or a checksum. Both binaries are copies of a program from the image,
# and how large that program is depends on the architecture it was built for, which no page may
# print. Builds are told apart with `cmp` instead.

umask 0022

for name in tips-agent tips-job tips-deployer; do
  pkill -x "$name" 2>/dev/null || true
done
for _ in $(seq 1 50); do
  pgrep -x 'tips-agent|tips-job|tips-deployer' >/dev/null 2>&1 || break
  sleep 0.1
done

rm -rf /srv/tips
mkdir -p /srv/tips/bin /srv/tips/releases

# The program the page is trying to deploy over, and the build waiting to replace it. `sleep` is
# a real ELF binary that stays up when given an argument, which is all the page needs of it.
cp /bin/sleep /srv/tips/bin/tips-agent
cp /bin/sleep /srv/tips/releases/tips-agent

# The two builds have to differ, or `cmp` cannot say which one is installed. Bytes after the last
# section of an ELF file are never read, so the marker leaves the new build runnable, which was
# checked in the sandbox before it was written here.
printf '\n#tips-agent build 2\n' >> /srv/tips/releases/tips-agent
chmod 755 /srv/tips/bin/tips-agent /srv/tips/releases/tips-agent

# A shell script, running, for the contrast the page draws: the kernel protects the interpreter
# and not the file it is reading, so this one can be overwritten while it runs and the binary
# above cannot.
cat > /srv/tips/bin/tips-job <<'EOF'
#!/bin/bash
while true; do sleep 3600; done
EOF
chmod 755 /srv/tips/bin/tips-job

# Held open for writing and never finished, which is the half-uploaded release a deployment script
# races. A file in this state cannot be executed, so it gives the page the refusal in the other
# direction.
cp /bin/sleep /srv/tips/bin/tips-stage
chmod 755 /srv/tips/bin/tips-stage
cat > /usr/local/bin/tips-deployer <<'PY'
#!/usr/bin/python3
import os, time
os.chdir("/srv/tips")
f = open("/srv/tips/bin/tips-stage", "r+b")
while True:
    time.sleep(3600)
PY
chmod 755 /usr/local/bin/tips-deployer

setsid /srv/tips/bin/tips-agent 3600 >/dev/null 2>&1 &
setsid /srv/tips/bin/tips-job >/dev/null 2>&1 &
setsid /usr/local/bin/tips-deployer >/dev/null 2>&1 &

# Waited for by what each process holds rather than by the process table, so the wait covers a
# process that is running and has not opened its file yet.
for _ in $(seq 1 50); do
  [ "$(pgrep -cx tips-agent)" = "1" ] &&
    [ -n "$(fuser /srv/tips/bin/tips-job 2>/dev/null)" ] &&
    [ -n "$(fuser /srv/tips/bin/tips-stage 2>/dev/null)" ] && break
  sleep 0.1
done
