#!/usr/bin/env bash
# Fixtures for content/commands/chmod/examples.yaml — must match its `fixtures:` block.
#
# Run this page with `--user`: root bypasses the permission checks the page documents, so
# `chmod 600 /etc/shadow` succeeds as root and `ls -l locked/` never reports a denial.
#
# Every mode is set explicitly (the sandbox runs with umask 0000, so a bare touch gives
# 666 and a bare mkdir gives 777), and every mtime is pinned, because `ls -l` output is
# what almost every example on this page prints.

# --- single files, each starting from a known mode --------------------------------
: > notes.txt
printf 'echo "deploying..."\n' > deploy.sh   # 20 bytes
: > report.csv
: > blank.txt                             # mode 000, for the conditional-execute X example
printf 'echo "backing up"\n' > backup.sh # left non-executable, for the "Permission denied" example
: > id_rsa
printf 'echo "running tool"\n' > tool     # 20 bytes
chmod 644 notes.txt
chmod 744 deploy.sh
chmod 644 report.csv
chmod 000 blank.txt
chmod 644 backup.sh
chmod 600 id_rsa
chmod 755 tool

# --- a directory, a shared directory, and a symlink -------------------------------
mkdir -p data shared
: > data/locked.txt
chmod 644 data/locked.txt
chmod 755 data
chmod 755 shared
ln -s notes.txt notes-link                # 9 bytes of target text

# --- the multi-file glob examples --------------------------------------------------
: > a.txt; : > b.txt; : > c.txt
chmod 644 a.txt b.txt c.txt

# --- project/: the recursive and auditing examples ---------------------------------
mkdir -p project/scripts project/data project/secrets
printf 'echo "deploying..."\n' > project/scripts/deploy.sh
: > project/data/report.csv
: > project/secrets/id_rsa
: > project/notes.txt
: > project/oops.txt
chmod 644 project/scripts/deploy.sh project/data/report.csv project/notes.txt
chmod 600 project/secrets/id_rsa
chmod 666 project/oops.txt                # world-writable, for the -perm -002 audit
chmod 755 project project/scripts project/data project/secrets

# --- locked/: unreadable directory contents, for the troubleshooting section -------
mkdir -p locked
: > locked/secret.txt
chmod 600 locked/secret.txt
chmod 600 locked                          # readable, but not executable: names list, stat fails

# --- timestamps --------------------------------------------------------------------
# Pinned so the `ls -l` output every example prints is stable. locked/ is set before it
# is made unreadable above, so this list deliberately excludes it.
touch -d "2026-08-12 21:45:00" notes.txt deploy.sh report.csv id_rsa tool a.txt b.txt c.txt blank.txt backup.sh
touch -d "2026-08-12 21:45:00" data shared data/locked.txt
touch -h -d "2026-08-12 21:45:00" notes-link
touch -d "2026-08-12 21:45:00" project/scripts/deploy.sh project/data/report.csv \
  project/secrets/id_rsa project/notes.txt project/oops.txt
touch -d "2026-08-12 21:45:00" project project/scripts project/data project/secrets
touch -d "2026-08-12 21:45:00" locked
