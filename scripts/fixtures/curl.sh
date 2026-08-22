#!/usr/bin/env bash
# Fixtures for content/commands/curl/examples.yaml. Must match its `fixtures:` block.
#
# Starts scripts/fixtures/http-mock.py, the local test server the examples send their
# POSTs, redirects, cookies, auth and status-code requests to. Only started if it isn't
# already listening: this script runs before every example, and re-binding the port each
# time would be both slow and racy.
#
# A second copy runs on 8443 with --tls, serving the same endpoints behind a self-signed
# certificate. The `-k` examples need a certificate nothing trusts: against a real HTTPS
# host with a valid certificate they print 200 whether or not the flag is there, which
# demonstrates nothing about the flag they are named after.
#
# Three examples on the page still reach the public internet (the TLS transcript, the
# transfer timings, and the one that reports the caller's own IP). All three are in
# curl.skip: what they print can't be pinned, so nothing here has to reach the network.

# Fails loudly if the server never answers. Every example on this page then reports a
# mismatch, which reads as forty broken examples rather than one missing process, and the
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
start_mock 8443 --tls
