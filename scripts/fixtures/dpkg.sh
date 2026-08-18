#!/usr/bin/env bash
# Fixtures for content/commands/dpkg/.
#
# Package state rather than files, plus one real .deb on disk for the examples that inspect a
# package before installing it. Every step is guarded: this runs again before each documented
# output, and re-downloading a package each time would dominate the run.

export DEBIAN_FRONTEND=noninteractive
umask 0022

find /etc/apt/sources.list.d -name '*.sources' ! -name 'debian.sources' -delete 2>/dev/null
rm -f /etc/apt/preferences.d/*

# See scripts/fixtures/apt.sh: silencing apt's "not a stable CLI interface" warning is the
# default for any page running apt, and this page runs it in its repair examples.
cat > /etc/apt/apt.conf.d/99-replay-no-script-warning <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "dpkg" ]; then
  apt-get update >/dev/null 2>&1
  echo dpkg > $STATE
fi

# Architecture: all throughout. `dpkg -l`, `dpkg -s` and `dpkg -I` all print an Architecture
# field, so an arch-dependent package would make this page pass on arm64 and fail on amd64 —
# see test/architecture.test.ts. cowsay, cowsay-off and ca-certificates are all `all`.

# cowsay installed: the query examples read it.
if ! dpkg -s cowsay >/dev/null 2>&1; then
  apt-get install -y cowsay >/dev/null 2>&1
fi

# bash-completion in the `rc` state — removed but not purged, configuration still on disk. The
# state the page's `dpkg -l` first column is there to explain.
if ! dpkg -l bash-completion 2>/dev/null | grep -q '^rc'; then
  apt-get install -y bash-completion >/dev/null 2>&1
  apt-get remove -y bash-completion >/dev/null 2>&1
fi

# cowsay-off absent, so the install examples have something to plan against.
if dpkg -s cowsay-off >/dev/null 2>&1; then
  apt-get purge -y cowsay-off >/dev/null 2>&1
fi

# A real .deb to inspect. Cached outside the working directory, because the working directory
# is emptied before every example and re-downloading would cost a network round trip each time.
CACHE=/var/cache/tips
mkdir -p "$CACHE"
if ! ls "$CACHE"/cowsay-off_*.deb >/dev/null 2>&1; then
  ( cd "$CACHE" && apt-get download cowsay-off >/dev/null 2>&1 )
fi
cp "$CACHE"/cowsay-off_*.deb ./cowsay-off.deb

# No holds: `dpkg --get-selections` prints the hold state, and a hold left by another page
# would change what this page's examples show.
apt-mark unhold cowsay ca-certificates >/dev/null 2>&1

# bash-completion must be the *only* package in the `rc` state, because one example lists every
# package whose state is not `ii` and would otherwise report whatever the previous page left
# behind. apt-essentials puts nano into `rc` deliberately, and in a full `npm run replay` that
# is still true by the time this page runs. Its own setup puts nano back when it needs it.
if dpkg -l nano 2>/dev/null | grep -q "^rc"; then
  apt-get purge -y nano >/dev/null 2>&1
fi
