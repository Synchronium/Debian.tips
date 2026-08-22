#!/usr/bin/env bash
# Fixtures for content/debian/release-channels.md.
#
# The page is about which archives a machine is pointed at, so the fixture is the sources
# configuration itself: backports added, and the stock file put back to what a real Debian
# install has.

export DEBIAN_FRONTEND=noninteractive

# Other prose pages' setups also configure apt, and `npm run replay` runs every page in one
# sandbox, so a source left behind by an earlier page changes what this one sees. Each page
# normalises the sources and preferences directories to exactly what it needs.
find /etc/apt/sources.list.d -name '*.sources' ! -name 'debian.sources' -delete 2>/dev/null
rm -f /etc/apt/preferences.d/*

# The official debian images pin each stanza to a snapshot with a comment line above the
# URI. That comment is a property of the image, not of Debian, and a reader would never see
# it: a harness artifact has to be removed rather than documented, so it goes here.
sed -i '/^# http:\/\/snapshot\.debian\.org/d' /etc/apt/sources.list.d/debian.sources

# The page shows a package that exists in both stable and backports, which needs the
# backports suite configured before apt can see it.
cat > /etc/apt/sources.list.d/backports.sources <<'EOF'
Types: deb
URIs: http://deb.debian.org/debian
Suites: trixie-backports
Components: main
Signed-By: /usr/share/keyrings/debian-archive-keyring.pgp
EOF
chmod 644 /etc/apt/sources.list.d/backports.sources

# Guarded: this runs again before every documented output, and re-fetching the backports
# index each time would dominate the run.
# Package lists are rebuilt when the previous page left different sources configured, which
# is once per page rather than once per documented output.
STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "release-channels" ]; then
  apt-get update >/dev/null 2>&1
  echo release-channels > $STATE
fi
