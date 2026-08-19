#!/usr/bin/env bash
# Fixtures for content/recipes/kill-whatever-is-using-a-port.md.
#
# Stands up something to find: a listener the page then identifies and kills.
#
# Port 9000 rather than the 8080 the recipe used to name. `npm run replay` runs every page in
# one sandbox, and the curl and wget pages have a mock server on 8080 — so `fuser -k 8080/tcp`
# here would have killed *their* fixture, on a page whose entire subject is killing whatever
# holds a port. The failure would have surfaced on curl, several pages later.
#
# Restarted rather than started once: this runs before every example, and the page's own
# `fuser -k` example kills the listener it is about to need again.

if ! ss -ltn 'sport = :9000' | grep -q 9000; then
  nohup python3 -m http.server 9000 --bind 0.0.0.0 >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    ss -ltn 'sport = :9000' | grep -q 9000 && break
    sleep 0.1
  done
fi
