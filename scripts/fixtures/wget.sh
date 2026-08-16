#!/usr/bin/env bash
# Fixtures for content/commands/wget/examples.yaml — must match its `fixtures:` block.
#
# Starts scripts/fixtures/http-mock.py, the same local test server the curl page uses, and
# creates the two small input files the batch-download and POST examples read. Only starts
# the server if it isn't already listening: this runs before every example.
#
# Replays as the unprivileged `user`, because two examples run `ls -l` on a downloaded
# file and the page shows `user user`.
# verify: --user

if ! curl -s -o /dev/null --max-time 2 http://localhost:8080/ 2>/dev/null; then
  python3 /opt/mock/http-mock.py 8080 >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    curl -s -o /dev/null --max-time 1 http://localhost:8080/ 2>/dev/null && break
    sleep 0.1
  done
fi

cat > urls.txt <<'EOF'
http://localhost:8080/site/a.html
http://localhost:8080/site/b.html
EOF

cat > body.json <<'EOF'
{"name": "deb1", "role": "backup"}
EOF
