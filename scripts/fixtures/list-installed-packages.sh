#!/usr/bin/env bash
# Fixtures for content/debian/list-installed-packages.md.
#
# The page reads the package database and the logs dpkg and apt keep, so the fixture puts one
# known package into both: installed recently enough to be the newest thing on the machine, and
# named in the rotated history the page searches.

export DEBIAN_FRONTEND=noninteractive
umask 0022

# `apt list` prints "WARNING: apt does not have a stable CLI interface" whenever stdout is not a
# terminal, which in this harness is always. A reader running it at a prompt never sees it. See
# scripts/fixtures/apt.sh, which explains why this is suppressed rather than documented.
cat > /etc/apt/apt.conf.d/99-replay-no-script-warning <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "list-installed-packages" ]; then
  apt-get update >/dev/null 2>&1
  echo list-installed-packages > $STATE
fi

# cowsay-off installed after everything the image installed, so it is the newest row in the logs
# and the answer to "what did I add most recently". Architecture: all, which is what keeps the
# dpkg.log lines printable: dpkg records a package's own architecture there, so an arch-dependent
# package would write `:arm64` here and `:amd64` on a CI runner. See test/architecture.test.ts.
if ! dpkg -s cowsay-off >/dev/null 2>&1; then
  apt-get install -y cowsay-off >/dev/null 2>&1
fi

# bash-completion removed but not purged, so the page has a row that is neither installed nor
# absent to show. `all` again, for the same reason.
if ! dpkg -l bash-completion 2>/dev/null | grep -q '^rc'; then
  apt-get install -y bash-completion >/dev/null 2>&1
  apt-get remove -y bash-completion >/dev/null 2>&1
fi

# Rotated apt history, which a machine older than a few weeks has and a fresh container does not.
# Written in apt's real format, architecture qualifiers included, taken from the machine running
# this rather than hard-coded: the page only ever prints the `Commandline:` lines, and a format
# invented to dodge that would teach a reader something no apt has written.
ARCH=$(dpkg --print-architecture)
if [ ! -f /var/log/apt/history.log.2.gz ]; then
  cat > /tmp/history.1 <<EOF

Start-Date: 2026-07-14  09:12:44
Commandline: apt install nginx
Requested-By: user (1000)
Install: nginx:$ARCH (1.26.3-3), nginx-common:all (1.26.3-3, automatic)
End-Date: 2026-07-14  09:12:51

Start-Date: 2026-07-28  16:40:02
Commandline: apt upgrade
Requested-By: user (1000)
Upgrade: libc6:$ARCH (2.41-12, 2.41-13)
End-Date: 2026-07-28  16:40:39
EOF
  cat > /tmp/history.2 <<EOF

Start-Date: 2026-06-02  11:05:20
Commandline: apt install cowsay
Requested-By: user (1000)
Install: cowsay:all (3.03+dfsg2-8)
End-Date: 2026-06-02  11:05:23

Start-Date: 2026-06-19  08:31:10
Commandline: apt purge telnet
Requested-By: user (1000)
Purge: telnet:all (0.17+2.5-4)
End-Date: 2026-06-19  08:31:12
EOF
  gzip -c /tmp/history.1 > /var/log/apt/history.log.1.gz
  gzip -c /tmp/history.2 > /var/log/apt/history.log.2.gz
  rm -f /tmp/history.1 /tmp/history.2
fi
chmod 644 /var/log/apt/history.log.*.gz
