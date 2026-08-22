#!/usr/bin/env bash
# Fixtures for content/concepts/pipes-and-redirection.md.
#
# Nothing to create: every example on the page builds its own input out of `echo`, a
# heredoc, or process substitution, which is the point of a page about plumbing rather
# than about files. This script exists for the directive below, and to opt the page into
# the replay: a prose page without one is reported as unverified rather than passed.
#
# The heredoc example expands `$(whoami)` in front of the reader, so who runs it is part of
# the output. As root it prints `Line two: root`, which is not the line the page shows.
# verify: --user
