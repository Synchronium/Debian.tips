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

# Fails loudly if the server never answers. Every example on this page then reports a
# mismatch, which reads as forty broken examples rather than one missing process — and the
# reason (a port in use, no IPv6 loopback in this environment) is in the server's own
# output, which is why that gets printed here rather than discarded.
start_mock() {  # port [extra http-mock.py args...]
  local port=$1; shift
  local scheme=http insecure=()
  if [ "${1:-}" = "--tls" ]; then scheme=https; insecure=(-k); fi

  curl -s "${insecure[@]}" -o /dev/null --max-time 2 "$scheme://127.0.0.1:$port/" 2>/dev/null && return 0

  python3 /opt/mock/http-mock.py "$port" "$@" > "/tmp/mock-$port.log" 2>&1 &
  for _ in $(seq 1 40); do
    curl -s "${insecure[@]}" -o /dev/null --max-time 1 "$scheme://127.0.0.1:$port/" 2>/dev/null && return 0
    sleep 0.1
  done

  echo "fixtures: http-mock.py never answered on $scheme://127.0.0.1:$port/" >&2
  cat "/tmp/mock-$port.log" >&2
  exit 1
}

start_mock 8080

cat > urls.txt <<'EOF'
http://127.0.0.1:8080/site/a.html
http://127.0.0.1:8080/site/b.html
EOF

cat > body.json <<'EOF'
{"name": "deb1", "role": "backup"}
EOF
