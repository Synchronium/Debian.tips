#!/usr/bin/env bash
# Fixtures for content/commands/curl/examples.yaml — must match its `fixtures:` block.
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

if ! curl -s -o /dev/null --max-time 2 http://localhost:8080/ 2>/dev/null; then
  python3 /opt/mock/http-mock.py 8080 >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    curl -s -o /dev/null --max-time 1 http://localhost:8080/ 2>/dev/null && break
    sleep 0.1
  done
fi

if ! curl -sk -o /dev/null --max-time 2 https://localhost:8443/ 2>/dev/null; then
  python3 /opt/mock/http-mock.py 8443 --tls >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    curl -sk -o /dev/null --max-time 1 https://localhost:8443/ 2>/dev/null && break
    sleep 0.1
  done
fi
