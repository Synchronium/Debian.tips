#!/usr/bin/env bash
# Fixtures for content/scripting/traps-and-cleanup.md: deliberately none.
#
# Every example writes the scripts it runs, into the working directory the harness clears and
# rebuilds before each one. That reset is what the page's counts depend on: an example asserting
# "0 temp files" would pass or fail on whatever an earlier example had left behind.
