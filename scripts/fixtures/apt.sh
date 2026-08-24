#!/usr/bin/env bash
# Fixtures for content/commands/apt/.
#
# The page's sample data is package state rather than files, so this puts the sandbox into the
# states the examples document. Every step is guarded: this runs again before each documented
# output, and an unguarded apt-get install would spend seconds per block re-doing settled work.

export DEBIAN_FRONTEND=noninteractive

# `apt` prints "WARNING: apt does not have a stable CLI interface" whenever stdout is not a
# terminal, which in this harness is always. A reader running these examples at a prompt
# never sees it, so capturing it would put a line on every block that the page's own audience
# cannot reproduce. Suppressed here for the same reason the harness pins the umask: it removes
# a difference caused by the sandbox not being a terminal, not a difference in what apt does.
#
# The warning itself is not swept under the carpet: /compare/apt-vs-apt-get/ documents it
# deliberately, in a pipe, where it is exactly what a reader would see.
cat > /etc/apt/apt.conf.d/99-replay-no-script-warning <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

# Package lists are fetched once per container rather than once per example. This script runs
# before every documented output, and `apt-get update` is three seconds of network each time.
STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "apt" ]; then
  apt-get update >/dev/null 2>&1
  echo apt > $STATE
fi

# Examples that show a package's identity use Architecture: all packages throughout: cowsay,
# bash-completion, ca-certificates, tzdata. An arch-dependent package prints "arm64" here and
# "amd64" on a CI runner, so the same page cannot pass in both places. This is the constraint
# that keeps `apt list`, `apt search`, `apt show` and `dpkg -l` off most pages; choosing the
# package carefully is what lets this one show them.

# cowsay installed: the query, removal, hold and mark examples all act on it, and an
# `all` package keeps `apt list`/`apt show` output identical on arm64 and amd64.
if ! dpkg -s cowsay >/dev/null 2>&1; then
  apt-get install -y cowsay >/dev/null 2>&1
fi

# cowsay-off absent, and also Architecture: all, so the install and simulate examples plan work
# against it. A separate package from the one above so neither example undoes the other's
# starting state.
if dpkg -s cowsay-off >/dev/null 2>&1; then
  apt-get purge -y cowsay-off >/dev/null 2>&1
fi

# bash-completion in the `rc` state: removed but not purged, configuration still on disk.
# Installing then removing (not purging) is the only way to reach it, and it is what the
# purge-an-already-removed-package example is about.
if ! dpkg -l bash-completion 2>/dev/null | grep -q '^rc'; then
  apt-get install -y bash-completion >/dev/null 2>&1
  apt-get remove -y bash-completion >/dev/null 2>&1
fi

# Reset the marks cowsay carries, because two examples on this page change them and fixtures are
# restored by re-running this script rather than by rolling the package database back. Without
# this, `apt-mark auto` leaks forward into the examples below it: cowsay reads as auto-removable
# in a later `apt search`, an `apt autoremove -s` three examples down proposes removing it, and
# the mark example itself reports "was already set" on the second run.
apt-mark manual cowsay >/dev/null 2>&1
apt-mark unhold cowsay >/dev/null 2>&1

# The perl chain arrived as cowsay's dependencies and must read as automatically installed:
# `apt remove -s cowsay` names all four in its "no longer required" notice, which is the point
# of that example. Asserted rather than assumed, because the install and mark examples above run
# between restores and apt revises these marks as it goes.
apt-mark auto perl perl-modules-5.40 libperl5.40 libgdbm-compat4t64 libtext-charwidth-perl >/dev/null 2>&1

# ca-certificates held, so the three hold examples tell one consistent story across restores:
# `hold` acts on cowsay and reports a change, `showhold` has something to list, and `unhold`
# acts on this one and reports cancelling a hold that was really there. Held here rather than
# by an earlier example because every example starts from this script, not from the last one.
apt-mark hold ca-certificates >/dev/null 2>&1
