#!/usr/bin/env bash
# Fixtures for content/compare/remove-vs-purge-vs-autoremove.md.
#
# Package state rather than files. The page tells two stories and needs the sandbox in both
# starting positions at once, because fixtures are restored before every documented block:
#
#   nano       removed but not purged, so /etc/nanorc is still on disk
#   cowsay-off installed, having dragged cowsay in as an automatically-installed dependency
#
# Every step is guarded: this runs again before each documented output, and an unguarded
# apt-get install would spend seconds per block re-doing settled work.
#
# Note for anyone extending this page: nano is an arch-dependent package, so nothing here may
# print a `dpkg -l` row or an `apt list` line for it, since those carry `arm64` locally and `amd64`
# on a CI runner. cowsay and cowsay-off are both Architecture: all and can be shown either way.
# Package versions are the other trap: `Purging configuration files for nano (8.4-1)` and
# `Remv cowsay [3.03+dfsg2-8]` both drift with a point release, so every block here narrows to
# lines that name packages and not versions.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive

# See scripts/fixtures/apt.sh: apt prints "WARNING: apt does not have a stable CLI interface"
# whenever stdout is not a terminal, which in this harness is always, and a reader running these
# examples at a prompt never sees it. /compare/apt-vs-apt-get/ is where that warning is
# documented deliberately; here it would put a line on every block nobody can reproduce.
cat > /etc/apt/apt.conf.d/99-replay-no-script-warning <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

apt_update_once

# nano in the `rc` state: binaries gone, /etc/nanorc still there. It is the file the whole
# remove-versus-purge distinction rests on, and the page shows it disappearing.
if ! dpkg -l nano 2>/dev/null | grep -q '^rc'; then
  apt-get install -y nano >/dev/null 2>&1
  apt-get remove -y nano >/dev/null 2>&1
fi

# cowsay-off installed, which pulls cowsay in with it. Installing cowsay-off alone is what
# makes the auto mark real rather than asserted: apt sets it because nobody asked for cowsay.
if ! dpkg -l cowsay-off 2>/dev/null | grep -q '^ii'; then
  apt-get install -y cowsay-off >/dev/null 2>&1
fi

# Both marks are reset rather than assumed, because the page's own last block runs
# `apt-mark manual cowsay`. Without this, every auto-mark block above it reports the opposite of
# what it documents from the second restore onwards.
apt-mark auto cowsay >/dev/null 2>&1
apt-mark manual cowsay-off >/dev/null 2>&1

# perl and libtext-charwidth-perl arrived as cowsay's dependencies and are therefore auto too,
# which would make `apt autoremove` propose five packages and a perl chain nobody on a real
# Debian system would recognise as orphaned. Marking them manual is what a real machine looks
# like (perl is there because the system wants it) and it narrows autoremove's answer to the
# one package the page is actually about.
apt-mark manual perl libtext-charwidth-perl >/dev/null 2>&1

# One block sweeps the whole database for `rc` packages and documents a single row, so nano above
# has to be the only one. Nothing else here or on the page puts a package into that state, and
# the image ships none, so the row is the one this script creates.
