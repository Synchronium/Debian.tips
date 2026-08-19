#!/usr/bin/env bash
# Fixtures for content/recipes/monitor-a-log-in-real-time.md.
#
# Both documented blocks are skipped, and the skips are the honest answer rather than a gap:
# `tail -f` does not exit, and what the page shows is new lines arriving from somewhere else
# while it runs. A batch replay has no second terminal to write them. The `.skip` reasons say
# how each was checked by hand instead.
#
# The file still has to exist, because the page's own text is about watching a real log and a
# reader following along needs something to point at.

printf 'info: worker started\ninfo: listening on :8080\n' > app.log
