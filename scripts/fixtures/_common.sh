# Shared fixture bodies, sourced by the per-page setup scripts.
#
# Several pages document the same sample files, so a reader moving from cut to sort to uniq
# should meet the same users.csv, not three files that happen to share a name. Keeping one
# definition is what makes that true.
#
# A setup script runs inside the sandbox, where the repository isn't mounted, so it can't source
# a relative path. The harness installs this file alongside the setup script, and a page sources
# it by absolute path:
#
#     . /tmp/fixtures-common.sh
# Fetches the package lists once per container.
#
# A setup script runs again before every documented output on its page, and `apt-get update` is
# seconds of network each time, so a page with twenty examples would spend a minute of its run
# re-fetching an index that has not changed. The marker file is what makes the second call onwards
# a no-op.
#
# It is a plain existence test rather than a comparison against the page's name. Under ADR-0020
# each page gets a container of its own, so the marker can only ever have been written by this
# page: a name to compare against was a defence the shared sandbox needed, and comparing one now
# reads as though two pages could still meet.
#
# Under /var/lib/apt because that is what the marker is about, and because it is a directory the
# per-example restore does not touch: the restore empties the page's working directory, so a
# marker kept there would be deleted before every example and fetch every time.
APT_UPDATED_MARKER=/var/lib/apt/.fixture-apt-updated
apt_update_once() {
  [ -e "$APT_UPDATED_MARKER" ] && return 0
  apt-get update >/dev/null 2>&1
  : > "$APT_UPDATED_MARKER"
}

mk_projects() { (
# A directory tree, shared by every page that documents one. Built in a subshell so the
# `cd` below cannot leak into the caller.
#
# Modes are set explicitly on everything, never left to the umask. That umask belongs to
# the host rather than the image (0000 on this project's devcontainer, 0022 on a CI
# runner) so an inherited one gives a different tree in each place. Under 0000 a bare
# mkdir produces a 777 directory, and every -perm example on a page then matches the
# entire tree.
#
# Ownership is set to user:user because pages print an owner column, and the site's
# convention is deb1/user rather than root.
#
# Mtimes are pinned for the same reason a mode is: `ls -lt` and `find -newer` both order
# by them, so an unpinned tree sorts differently on every run.
#
# Nothing here controls the *order* a command prints. Directory order is hash order on
# this filesystem (four entries created a,b,c,d read back as d,b,c,a), so any example
# whose output is more than one line has to impose an order of its own.
mkdir -p projects
cd projects || exit 1

# --- backups/: two archives, one older than a year, one recent -----------------
mkdir -p backups
yes "site-2026-06-01 backup payload" | head -c 5120 > backups/site-2026-06-01.tar.gz
yes "site-2026-01-01 backup payload" | head -c 5120 > backups/site-2026-01-01.tar.gz
chmod 644 backups/site-2026-06-01.tar.gz
chmod 600 backups/site-2026-01-01.tar.gz

# --- logs/: a live symlink, two logs, and a deliberately broken symlink ---------
# main-link.js resolves to a regular file (-xtype f); rotated-link does not resolve at
# all (-xtype l), the shape left behind when a rotated log is later deleted. The page
# teaches both tests, so the tree has to contain both. rotated-link deliberately matches
# neither *.js nor *.log, so it only shows up in the symlink and -perm examples.
mkdir -p logs
ln -s ../src/main.js logs/main-link.js
yes "log line" | head -c 6291456 > logs/big.log
yes "log line" | head -c 10240 > logs/app.log
ln -s app.log.1.gz logs/rotated-link
chmod 644 logs/big.log logs/app.log

# --- src/: the -newer reference file, a vendored subdir, a 777 script -----------
mkdir -p src
echo "// util" > src/util.js
mkdir -p src/vendor
echo "// lib" > src/vendor/lib.js
echo "// main" > src/main.js
chmod 644 src/util.js src/vendor/lib.js
chmod 777 src/main.js

# --- .hidden/ and an empty directory -------------------------------------------
mkdir -p .hidden
echo "TOKEN=secret" > .hidden/.env
chmod 644 .hidden/.env
mkdir -p empty-dir

chmod 755 . backups logs src src/vendor .hidden empty-dir

# --- timestamps ----------------------------------------------------------------
# src/util.js is the -newer reference: everything listed below it is newer, and
# site-2026-01-01.tar.gz is the only thing older (and the only -mtime +365 match).
touch -d "2025-05-31 12:00:00" backups/site-2026-01-01.tar.gz
touch -d "2026-06-01 09:00:00" src/util.js
touch -d "2026-06-15 15:30:00" backups/site-2026-06-01.tar.gz
touch -d "2026-06-20 10:00:00" logs/big.log
touch -d "2026-06-21 10:00:00" logs/app.log
touch -d "2026-06-22 10:00:00" src/vendor/lib.js
touch -d "2026-06-23 10:00:00" src/main.js
touch -d "2026-06-24 10:00:00" .hidden/.env
touch -h -d "2026-06-25 10:00:00" logs/main-link.js logs/rotated-link
touch -d "2026-06-26 10:00:00" backups logs src src/vendor .hidden empty-dir
touch -d "2026-06-26 10:00:00" .   # the tree root, so the fixture listing does not drift

cd ..
chown -R user:user projects 2>/dev/null || true
) }
mk_site_tree() { (
# A small tree with one nested directory and one empty one, shared by the pages that copy,
# move and delete. Those three teach the same distinctions against each other - a directory
# that exists versus one that does not, a file versus the link to it - so a reader moving
# between them should meet one `site/` rather than three that resemble each other.
#
# Modes, ownership and mtimes are all set explicitly, for the reasons `mk_projects` gives
# above: the umask belongs to the host rather than the image, and `cp -u` and `ls -lt` both
# read timestamps a fresh checkout would otherwise stamp with the time of the checkout.
#
# style.css is deliberately the newest file and index.html the oldest, which is what lets
# `cp -u` copy one and skip the other without either page having to touch a timestamp first.
mkdir -p site/assets site/backups
printf '<!doctype html>\n<title>deb1</title>\n' > site/index.html
printf 'body { font-family: monospace; }\n' > site/style.css
printf '<svg width="16" height="16"></svg>\n' > site/assets/logo.svg
printf 'Rebuild before deploying.\n' > notes.txt

# All three pages have to say what they do to a symlink rather than to the file behind it, and
# each answers it differently: cp follows by default, mv never does, rm never does. A tree with
# no symlink in it cannot show any of that.
ln -s style.css site/latest.css

chmod 644 site/index.html site/style.css site/assets/logo.svg notes.txt
chmod 755 site site/assets site/backups

touch -d "2026-06-01 09:00:00" site/index.html
touch -d "2026-06-20 09:00:00" site/style.css
touch -d "2026-06-10 09:00:00" site/assets/logo.svg
touch -d "2026-06-10 09:00:00" notes.txt
touch -h -d "2026-06-18 09:00:00" site/latest.css
touch -d "2026-06-15 10:00:00" site/assets site/backups site
chown -R user:user site notes.txt 2>/dev/null || true
) }
mk_users_csv() { cat > users.csv <<'EOF'
name,age,department
Alice,34,Engineering
Bob,29,Sales
Carol,41,Engineering
Dave,25,Marketing
Erin,38,Sales
Frank,31,Engineering
EOF
}
mk_wordlist() { cat > wordlist.txt <<'EOF'
banana
apple
Cherry
apple
date
banana
apple
Elderberry
cherry
EOF
}
mk_access_log() { cat > access.log <<'EOF'
203.0.113.5 - - [13/Aug/2026:09:12:01] "GET /index.html HTTP/1.1" 200 512
203.0.113.5 - - [13/Aug/2026:09:12:03] "GET /style.css HTTP/1.1" 200 231
198.51.100.7 - - [13/Aug/2026:09:14:22] "GET /index.html HTTP/1.1" 200 512
198.51.100.7 - - [13/Aug/2026:09:14:25] "GET /missing.html HTTP/1.1" 404 162
203.0.113.5 - - [13/Aug/2026:09:15:47] "GET /index.html HTTP/1.1" 200 512
192.0.2.44 - - [13/Aug/2026:09:16:03] "POST /login HTTP/1.1" 302 0
192.0.2.44 - - [13/Aug/2026:09:16:04] "GET /dashboard HTTP/1.1" 200 4021
198.51.100.7 - - [13/Aug/2026:09:18:51] "GET /index.html HTTP/1.1" 200 512
203.0.113.5 - - [13/Aug/2026:09:19:10] "GET /api/status HTTP/1.1" 500 89
192.0.2.44 - - [13/Aug/2026:09:20:33] "GET /dashboard HTTP/1.1" 200 4021
EOF
}
mk_report() { for i in $(seq 1 40); do echo "line $i of the report"; done > report.txt; }
mk_open_files() {
# The processes that lsof and fuser report on. Both pages ask the same question of the same
# machine, so a reader moving between them meets one set of open files rather than two that
# resemble each other.
#
# Every process name is at most nine characters except tips-archiver, which is over on
# purpose: lsof truncates the COMMAND column at nine and prints the rest only when asked, so
# a page documenting `+c 0` needs a name long enough to be cut.
#
# Each one is a script with a shebang naming the interpreter directly. `#!/usr/bin/env
# python3` executes env, which executes Python, and a process is named after the file the
# kernel was told to run, so every one of these would come back as `python3`.
#
# /srv/cache is a tmpfs rather than an ordinary directory. `fuser -m` reports on a whole
# filesystem and lsof's DEVICE column names one, and left on the container's root both would
# answer about the host's overlay: every process on the machine for the first, and a device
# number belonging to whoever started the container for the second.
#
# Sizes are written explicitly because both pages print a SIZE column.

  # Rebuilt only when something is missing, since starting four interpreters and a mount costs
  # more than every example on either page put together. The test is the open files themselves
  # rather than the processes holding them, so it covers both a process an example killed and a
  # file an example closed.
  open_files_ready() {
    [ -n "$(lsof -t /srv/tips/app.log 2>/dev/null)" ] &&
      [ -n "$(lsof -t /srv/tips/spool/job-0142.json 2>/dev/null)" ] &&
      [ -n "$(lsof -t /srv/cache/site.tar 2>/dev/null)" ] &&
      [ "$(lsof -t -i :8080 2>/dev/null | wc -l)" = "2" ] &&
      lsof +L1 /srv/cache 2>/dev/null | grep -q 'scratch\.dat (deleted)'
  }
  open_files_ready && return 0

  # Killed by exact name. `pkill -f tips-` would match the shell running this script, because
  # `-f` tests the whole command line rather than the process name.
  for name in tips-log tips-api tips-tmp tips-archiver tips-job tips-client; do
    pkill -x "$name" 2>/dev/null || true
  done

  # Waited for by the files they held rather than by `pgrep`. This sandbox's pid 1 is the `sleep`
  # holding the container open, which reaps nothing, so a killed process stays in the table as a
  # zombie carrying its own name for as long as the container runs. A zombie holds no files, so
  # both pages report on it correctly and only a wait written against `pgrep` would hang.
  for _ in $(seq 1 50); do
    [ -z "$(lsof -t /srv/tips/app.log /srv/tips/queue.dat /srv/cache/site.tar 2>/dev/null)" ] && break
    sleep 0.1
  done

  mountpoint -q /srv/cache && umount -l /srv/cache
  rm -rf /srv/tips
  mkdir -p /srv/tips/spool /srv/cache
  mount -t tmpfs -o size=20M,nr_inodes=2000 tmpfs /srv/cache

  # One file in a subdirectory, held open like the rest. Without it `+d` and `+D` print the
  # same thing, and a page showing both would be documenting a distinction it never made.
  yes "queued job payload" | head -c 4096 > /srv/tips/queue.dat
  printf '{"id": 142, "state": "running"}\n' > /srv/tips/spool/job-0142.json
  : > /srv/tips/app.log
  chmod 755 /srv/tips /srv/tips/spool
  chmod 644 /srv/tips/queue.dat /srv/tips/app.log /srv/tips/spool/job-0142.json
  chown -R user:user /srv/tips

  # Holds its log open for append, which is what a service does and what stops the space
  # coming back when someone deletes one.
  cat > /usr/local/bin/tips-log <<'PY'
#!/usr/bin/python3
import os, time
os.chdir("/srv/tips")
f = open("/srv/tips/app.log", "a")
f.write("worker started\n")
f.flush()
while True:
    time.sleep(3600)
PY

  # Listens on every address, so `lsof -i` has a socket to report and `fuser -n tcp` has a
  # port. The backlog is not asserted anywhere; 128 is what a service would ask for.
  cat > /usr/local/bin/tips-api <<'PY'
#!/usr/bin/python3
import os, socket, time
os.chdir("/srv/tips")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 8080))
s.listen(128)
while True:
    time.sleep(3600)
PY

  # Writes five megabytes to the tmpfs and then unlinks the file while still holding it. The
  # name is gone from the directory and the blocks are not, so `df` and `du` disagree about
  # /srv/cache by exactly this much until the process exits. Five megabytes of twenty, against
  # the one that site.tar accounts for, so both figures are legible on the page.
  cat > /usr/local/bin/tips-tmp <<'PY'
#!/usr/bin/python3
import os, time
os.chdir("/srv/cache")
f = open("/srv/cache/scratch.dat", "w")
f.write("x" * 5242880)
f.flush()
os.unlink("/srv/cache/scratch.dat")
while True:
    time.sleep(3600)
PY

  # The only one whose working directory is on the tmpfs, so `fuser -m /srv/cache` names one
  # process rather than every process that happens to be running.
  cat > /usr/local/bin/tips-archiver <<'PY'
#!/usr/bin/python3
import os, time
os.chdir("/srv/cache")
f = open("/srv/cache/site.tar", "w")
f.write("y" * 1048576)
f.flush()
while True:
    time.sleep(3600)
PY

  # Runs as `user` and reads rather than writes, so both pages can show the USER column
  # distinguishing two processes and the access mode distinguishing a reader from a writer.
  cat > /usr/local/bin/tips-job <<'PY'
#!/usr/bin/python3
import os, time
os.chdir("/srv/tips")
f = open("/srv/tips/queue.dat", "r")
f.read(1024)
j = open("/srv/tips/spool/job-0142.json", "r")
j.read()
while True:
    time.sleep(3600)
PY

  # Connects to tips-api and holds the connection open, so both pages can show a port in use by
  # something other than the process listening on it. Holding it rather than reconnecting keeps
  # the client's ephemeral port the same for every example in a run.
  # Binds its own source port before connecting rather than taking whatever the kernel offers.
  # Both pages print that port, and an ephemeral one is a different number on every run.
  cat > /usr/local/bin/tips-client <<'PY'
#!/usr/bin/python3
import os, socket, time
os.chdir("/srv/tips")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", 45400))
s.connect(("127.0.0.1", 8080))
while True:
    time.sleep(3600)
PY

  chmod 755 /usr/local/bin/tips-log /usr/local/bin/tips-api /usr/local/bin/tips-tmp \
    /usr/local/bin/tips-archiver /usr/local/bin/tips-job /usr/local/bin/tips-client

  # Started one at a time, each waited for before the next. lsof reports in the order it reads
  # /proc, which is the order the pids were handed out, so starting them together would list
  # them in whatever order the kernel happened to schedule them.
  #
  # Each sets its own working directory rather than being started from one. A `( cd dir &&
  # setsid prog & )` leaves the subshell itself running with that directory open, and a page
  # about open files would then be reporting on its own fixture script.
  setsid /usr/local/bin/tips-log </dev/null >/dev/null 2>&1 &
  for _ in $(seq 1 100); do [ -n "$(lsof -t /srv/tips/app.log 2>/dev/null)" ] && break; sleep 0.1; done
  setsid /usr/local/bin/tips-api </dev/null >/dev/null 2>&1 &
  for _ in $(seq 1 100); do [ -n "$(lsof -t -i :8080 2>/dev/null)" ] && break; sleep 0.1; done
  setsid /usr/local/bin/tips-tmp </dev/null >/dev/null 2>&1 &
  for _ in $(seq 1 100); do lsof +L1 /srv/cache 2>/dev/null | grep -q 'scratch\.dat (deleted)' && break; sleep 0.1; done
  setsid /usr/local/bin/tips-archiver </dev/null >/dev/null 2>&1 &
  for _ in $(seq 1 100); do [ -n "$(lsof -t /srv/cache/site.tar 2>/dev/null)" ] && break; sleep 0.1; done
  setsid setpriv --reuid=user --regid=user --init-groups /usr/local/bin/tips-job </dev/null >/dev/null 2>&1 &
  for _ in $(seq 1 100); do [ -n "$(lsof -t /srv/tips/spool/job-0142.json 2>/dev/null)" ] && break; sleep 0.1; done
  setsid /usr/local/bin/tips-client </dev/null >/dev/null 2>&1 &
  for _ in $(seq 1 100); do open_files_ready && break; sleep 0.1; done
}
