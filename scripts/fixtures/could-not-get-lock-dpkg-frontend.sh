#!/usr/bin/env bash
# Fixtures for content/troubleshooting/could-not-get-lock-dpkg-frontend.md.
#
# Nothing to create. The page's reproduction takes a real fcntl lock on the real
# /var/lib/dpkg/lock-frontend from a backgrounded perl, inside a single fence, so the lock is
# held and released within the one example. Nothing persists between examples and no fixture
# file is involved.
#
# The perl holder sleeps 3s, deliberately under the harness's 5s per-example timeout: it
# inherits the capture pipe, so a longer sleep would hold the pipe open past the timeout and
# report as a mismatch rather than as the lock error the page documents.
