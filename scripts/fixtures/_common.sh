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
