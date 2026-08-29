#!/usr/bin/env bash
# Fixtures for content/scripting/here-docs.md: deliberately none.
#
# The examples that write a file write it into the working directory, which the harness clears
# and rebuilds before each one, so `app.conf` never exists when the example that creates it runs.
# This file exists because a page opts in to the replay by having one: without it the page would
# be listed as unverified, which would be untrue.
#
# The `<<-` example depends on the tabs in the page source being tabs. Prettier never touches
# `content/`, which is what keeps that true; see `.prettierignore`.
