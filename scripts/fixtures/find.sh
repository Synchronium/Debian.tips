#!/usr/bin/env bash
# Fixtures for content/commands/find/examples.yaml — must match its `fixtures:` block.
#
# Modes are set explicitly on everything. The sandbox runs with umask 0000, so a bare
# mkdir produces a 777 directory and every -perm example on the page matches the entire
# tree. Never rely on the inherited umask here.
#
# Ownership is set to user:user because the page's `ls -lh` example prints an owner
# column, and the site's convention is deb1/user rather than root.
#
# Nothing here controls the *order* find prints: directory order is hash order on this
# filesystem (four entries created a,b,c,d read back as d,b,c,a), so every example whose
# output is more than one line pipes through `sort`.

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
