#!/usr/bin/env bash
# Fixtures for content/troubleshooting/disk-full.md.
#
# verify: --privileged
#
# Two tmpfs filesystems, because the page's subject is a filesystem with no room left and the
# container's own root is an overlay on somebody else's disk. Its size is whatever the machine
# running the replay has, so a page reporting on it would print a different figure everywhere and
# could never be filled up on purpose.
#
# Mounting needs CAP_SYS_ADMIN, which is what the `verify:` line above asks for.
#
# Remounted from scratch here rather than created once. This script runs before every example and
# the restore only empties the page's working directory, so the example that fills the last of the
# space would otherwise leave it full for everything after it.

umask 0022

for mnt in /srv/disk /srv/small; do
  mountpoint -q "$mnt" && umount "$mnt"
  mkdir -p "$mnt"
done

# `size=` and `nr_inodes=` on both, and neither is optional. A tmpfs left to itself takes half of
# RAM and sizes its inode table to match, so every figure the page prints would belong to whichever
# machine ran it.
mount -t tmpfs -o size=20M,nr_inodes=2000 tmpfs /srv/disk
mount -t tmpfs -o size=10M,nr_inodes=32 tmpfs /srv/small

# A filesystem laid out the way a small server's root is, so the page's `du` examples have
# somewhere to point. The one large file and the one large directory are the two shapes a
# full disk actually takes.
mkdir -p /srv/disk/var/log/tips /srv/disk/var/cache/tips /srv/disk/var/lib/tips /srv/disk/home/user
dd if=/dev/zero of=/srv/disk/var/log/tips/app.log bs=1M count=11 status=none
for n in 1 2 3 4 5 6; do
  dd if=/dev/zero of="/srv/disk/var/cache/tips/chunk-$n.bin" bs=512K count=1 status=none
done
dd if=/dev/zero of=/srv/disk/var/lib/tips/index.db bs=256K count=1 status=none
printf 'notes\n' > /srv/disk/home/user/notes.txt

# The inode table is what runs out here, not the space. Thirty-one small files against
# `nr_inodes=32` leaves no inode free, so a `touch` in an example fails while `df -h` still
# reports megabytes free, which is the case that makes the ordinary answer useless.
for n in $(seq 1 31); do
  printf 'x' > "/srv/small/message-$n.eml"
done

# Deletes its own file and keeps holding it. The name is gone from the directory so `du` cannot
# see it, and the blocks stay allocated until the process exits, so `df` still counts them. Four
# megabytes of the twenty, which is large enough to see in both figures.
# Holds the log open without writing to it, which is what a service does between messages. The
# page needs a file that is both large and held: deleting one of those returns no space at all,
# and that is the difference between `rm` and truncating it.
cat > /usr/local/bin/tips-logger <<'PY'
#!/usr/bin/python3
import os, time
os.chdir("/srv/disk")
f = open("/srv/disk/var/log/tips/app.log", "a")
while True:
    time.sleep(3600)
PY
chmod 755 /usr/local/bin/tips-logger

cat > /usr/local/bin/tips-spool <<'PY'
#!/usr/bin/python3
import os, time
os.chdir("/srv/disk")
f = open("/srv/disk/var/lib/tips/spool.tmp", "w")
f.write("x" * 4194304)
f.flush()
os.unlink("/srv/disk/var/lib/tips/spool.tmp")
while True:
    time.sleep(3600)
PY
chmod 755 /usr/local/bin/tips-spool

pkill -x tips-spool 2>/dev/null || true
pkill -x tips-logger 2>/dev/null || true
setsid /usr/local/bin/tips-spool >/dev/null 2>&1 &
setsid /usr/local/bin/tips-logger >/dev/null 2>&1 &

# Waited for by the open files rather than by `pgrep`. A killed process left as a zombie under
# this sandbox's pid 1 still answers to its own name without holding any file, so a wait
# written against the process table would return before the blocks were allocated.
for _ in $(seq 1 50); do
  lsof +L1 /srv/disk 2>/dev/null | grep -q 'spool\.tmp (deleted)' &&
    [ -n "$(lsof -t /srv/disk/var/log/tips/app.log 2>/dev/null)" ] && break
  sleep 0.1
done
