#!/usr/bin/env bash
# Fixtures for content/commands/free/.
#
# There is nothing to set up. Every figure `free` prints belongs to the machine the container runs
# on (ADR-0029), so the page's ordinary examples are exempt, in free.skip, and what it claims about
# them is checked by its proof examples, which compute each claim from one run and print a fixed
# answer. This script exists so that those, and the few outputs that are the same everywhere, are
# replayed.
