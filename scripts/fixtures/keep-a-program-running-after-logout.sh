#!/usr/bin/env bash
# Fixtures for content/recipes/keep-a-program-running-after-logout.md.
#
# Replayed as the unprivileged `user`, matching who is actually logging out of an ssh session.
# verify: --user

# Nothing to create: every example writes the script it runs.
#
# What this file is really recording is a rule the examples on this page have to obey, because
# breaking it does not fail, it hangs. A background process inherits the harness's stdout, and
# holds the whole batch open until it exits even when the page's own claim has already been
# checked. So every `&` here redirects all three streams first, and every example kills or waits
# out what it started before it ends. `disown` appears for a second reason: without it the shell
# announces each job's death on its own stderr, with a PID in it that changes every run.
