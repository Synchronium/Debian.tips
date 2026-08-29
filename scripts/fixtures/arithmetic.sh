#!/usr/bin/env bash
# Fixtures for content/scripting/arithmetic.md: deliberately none.
#
# Every example on that page sets its own variables and prints a number, so there is nothing to
# create. This file exists because a page opts in to the replay by having one: without it the
# page would be listed as unverified, which would be untrue.
#
# One claim on the page does depend on the sandbox rather than on the examples: that `bc` is not
# installed. Nothing here installs it, and nothing may, or the page would document a base Debian
# system by testing a modified one.
