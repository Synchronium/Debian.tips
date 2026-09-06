#!/usr/bin/env bash
# Fixtures for content/recipes/time-how-long-something-takes.md.
#
# The `time` package, which is the page's own subject: `/usr/bin/time` is not on a Debian system
# unless somebody installed it, and typing `time` at a prompt reaches bash's keyword instead. The
# page says so and then shows both, so the program has to be here for the second half to run.
#
# Installed here rather than by an example, because an example that installed it would be
# demonstrating its absence and then removing the evidence for every block after that one. What
# the page proves instead is `type time`, which answers the same question and stays true either
# way.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive

if [ ! -x /usr/bin/time ]; then
  apt_update_once
  apt-get install -y time >/dev/null 2>&1
fi
if [ ! -x /usr/bin/time ]; then
  echo "time-how-long-something-takes: /usr/bin/time did not install" >&2
  exit 1
fi
