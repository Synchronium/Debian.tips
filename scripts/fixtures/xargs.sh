#!/usr/bin/env bash
# Fixtures for content/commands/xargs/examples.yaml. Must match its `fixtures:` block.
#
# `logs/` holds one filename with a space in it. That file is the whole point of the -0 and
# -print0 examples: without it, every command on this page appears to work whether or not it
# handles separators, which is exactly the impression that gets people to write the broken form.
#
# Modes are never asserted on this page, so nothing here sets one. A bare `sandbox.sh exec`
# inherits the host's umask while the replay pins 0022, and an example that prints a mode
# would differ between the two.

. /tmp/fixtures-common.sh

mk_users_csv

cat > hosts.txt <<'EOF'
web1.example.com
web2.example.com
db1.example.com
cache1.example.com
EOF

cat > packages.txt <<'EOF'
curl
jq
rsync
EOF

rm -rf logs
mkdir -p logs/archive
printf 'boot: starting\nboot: ready\n' > logs/app.log
printf 'ERROR: disk full\nERROR: retry failed\nWARN: slow query\n' > logs/error.log
printf 'GET /index.html 200\nGET /missing 404\n' > logs/api.log
printf 'ERROR: old failure\n' > 'logs/last week.log'
printf 'archived\n' > logs/archive/2026-07.log
