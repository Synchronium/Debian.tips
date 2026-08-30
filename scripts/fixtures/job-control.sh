#!/usr/bin/env bash
# Fixtures for content/commands/job-control/examples.yaml.
#
# verify: --systemd
#
# The page's examples end with background jobs still running, and several of them disown one
# first, so it is orphaned rather than killed when the example's shell exits. Under the default
# sandbox PID 1 is the `sleep` holding the container open, which reaps nothing, and an orphan
# killed here would stay in the table as a zombie called `sleep`. Every example counting sleeps
# would then climb with the number of examples that had already run.

# The page makes its own jobs, so there is nothing to build. What has to be true before each
# example is that no `sleep` from the example before it is still around: a background job outlives
# the shell that started it, which is half of what the page is about.
#
# By exact name, never `pkill -f sleep`, which would match the shell running this script.
pkill -9 -x sleep 2>/dev/null || true

for _ in $(seq 1 100); do
  pgrep -x sleep >/dev/null 2>&1 || break
  sleep 0.1
done
