#!/usr/bin/env bash
# Fixtures for content/commands/curl/examples.yaml — must match its `fixtures:` block.
#
# Starts scripts/fixtures/http-mock.py, the local test server the examples send their
# POSTs, redirects, cookies, auth and status-code requests to. Only started if it isn't
# already listening: this script runs before every example, and re-binding the port each
# time would be both slow and racy.
#
# The examples that simply fetch a page still use https://example.com — IANA maintains it
# for exactly this purpose, and a reader gets the same result. Their headers carry a live
# date, which the harness normalises.

if ! curl -s -o /dev/null --max-time 2 http://localhost:8080/ 2>/dev/null; then
  python3 /opt/mock/http-mock.py 8080 >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    curl -s -o /dev/null --max-time 1 http://localhost:8080/ 2>/dev/null && break
    sleep 0.1
  done
fi
