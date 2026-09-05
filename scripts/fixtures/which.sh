#!/usr/bin/env bash
# Fixtures for content/commands/which/examples.yaml.
#
# verify: --user
#
# Replayed as the unprivileged `user` because `PATH` is what this page is about, and root's is
# not the one a reader has: it carries the `sbin` directories, so `which` and `type -a` would
# answer from a search path nobody reading this page is standing in.
#
# The page declares no sample data. Every example builds what it needs in the working directory
# or asks about a command the image already ships, so there is nothing to create here. The script
# exists so the page is replayed at all, and so that the `# verify:` line above has somewhere to
# live.
:
