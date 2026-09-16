#!/usr/bin/env bash
# Fixtures for content/troubleshooting/repository-does-not-have-a-release-file.md.
#
# Three repositories, because the error has three causes and they are told apart by what the
# server answers rather than by the message, which is identical in all three:
#
#   deb.tips-mirror.example:8086      publishes dists/stable/ and nothing else
#   archive.tips-mirror.example:8087  publishes dists/buster/, with a Release file that expired
#   files.tips-vendor.example:8088    a flat repository: packages at the root, no dists/ at all
#
# The names are /etc/hosts aliases for 127.0.0.1. Separate names rather than one name on three
# ports, because apt queues its fetches per host and a failure on one port is then reported
# against the others; scripts/fixtures/apt-update-failed.sh has that in full.
#
# The source file every example rewrites is tips.sources, and this script puts back the broken
# stanza the page opens on. An example that fixes it only fixes it for itself.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive
umask 0022

MIRROR=/srv/tips-mirror
ARCHIVE=/srv/tips-archive
FLAT=/srv/tips-flat
KEY_EMAIL=repos@example.com

# Debian's own sources are removed rather than left alone: every example runs `apt update` and
# prints what it says, so a source pointing at the real archive would put the archive's current
# contents into the page's output.
rm -f /etc/apt/sources.list.d/debian.sources
rm -f /etc/apt/preferences.d/*

# The retry backoff costs seven seconds on a refused connection, which is over the harness's
# per-example limit, and changes no line of what apt prints. The script warning is apt's "not a
# stable CLI interface" line, which a reader at a terminal never sees.
cat > /etc/apt/apt.conf.d/99-replay-release-file <<'EOF'
Acquire::Retries::Delay "false";
APT::Cmd::Disable-Script-Warning "1";
EOF

grep -q tips-mirror.example /etc/hosts || cat >> /etc/hosts <<'EOF'
127.0.0.1 deb.tips-mirror.example
127.0.0.1 archive.tips-mirror.example
127.0.0.1 files.tips-vendor.example
EOF

build_deb() {
  local into=$1
  local root=/build/tips-tool
  rm -rf "$root"
  mkdir -p "$root/DEBIAN"
  # Architecture: all, so no output on this page names a machine's architecture; see
  # test/architecture.test.ts.
  cat > "$root/DEBIAN/control" <<CTL
Package: tips-tool
Version: 1.0-1
Section: utils
Priority: optional
Architecture: all
Maintainer: Example <$KEY_EMAIL>
Description: Demonstration package served by each of this page's repositories
CTL
  dpkg-deb --build --root-owner-group "$root" "$into/tips-tool_1.0-1_all.deb" >/dev/null
}

build_suite() {
  # repo, suite: an ordinary repository, packages under pool/ and indexes under dists/<suite>/
  local repo=$1 suite=$2
  mkdir -p "$repo/pool/main" "$repo/dists/$suite/main/binary-all"
  build_deb "$repo/pool/main"
  ( cd "$repo"
    apt-ftparchive packages pool > "dists/$suite/main/binary-all/Packages"
    gzip -kf "dists/$suite/main/binary-all/Packages"
    apt-ftparchive -o APT::FTPArchive::Release::Origin=Example \
      -o "APT::FTPArchive::Release::Suite=$suite" \
      -o "APT::FTPArchive::Release::Codename=$suite" \
      -o APT::FTPArchive::Release::Components=main \
      -o APT::FTPArchive::Release::Architectures=all \
      release "dists/$suite" > "dists/$suite/Release" )
}

sign() {
  gpg --batch --yes --local-user "$KEY_EMAIL" --clearsign -o "$1/InRelease" "$1/Release"
}

# Guarded as a whole: this runs again before every documented output, and building three
# repositories and a signing key each time would dominate the page's replay.
if [ ! -f "$MIRROR/dists/stable/InRelease" ]; then
  gpg --batch --quiet --passphrase "" --pinentry-mode loopback \
    --quick-generate-key "Example <$KEY_EMAIL>" default default never
  mkdir -p /etc/apt/keyrings
  gpg --armor --export "$KEY_EMAIL" > /etc/apt/keyrings/tips-repos.asc
  chmod 644 /etc/apt/keyrings/tips-repos.asc

  # The mirror publishes the current suite only. A source asking it for an archived one gets a
  # 404 on the Release file, which is the page's opening error.
  build_suite "$MIRROR" stable
  sign "$MIRROR/dists/stable"

  # The archive publishes the retired suite, with a Release file whose Valid-Until has passed.
  # Both dates are fixed in the past, so the interval apt reports grows with every run and the
  # page compares that line by shape.
  build_suite "$ARCHIVE" buster
  sed -i '1i Date: Sat, 01 Feb 2025 00:00:00 UTC\nValid-Until: Sat, 08 Feb 2025 00:00:00 UTC' \
    "$ARCHIVE/dists/buster/Release"
  sign "$ARCHIVE/dists/buster"

  # A flat repository: one directory holding the packages and their index, with no dists/ and no
  # components. It answers the page's third cause, where the repository is fine and the stanza
  # asks it for a layout it does not have.
  mkdir -p "$FLAT"
  build_deb "$FLAT"
  ( cd "$FLAT"
    apt-ftparchive packages . > Packages
    gzip -kf Packages
    apt-ftparchive -o APT::FTPArchive::Release::Origin=Example release . > Release.tmp
    mv Release.tmp Release )
  sign "$FLAT"
fi

serve() {
  # port, directory, path that proves it is up
  local port=$1 dir=$2 probe=$3
  if ! curl -sf "http://127.0.0.1:$port/$probe" >/dev/null 2>&1; then
    ( python3 -m http.server "$port" --directory "$dir" --bind 127.0.0.1 >/dev/null 2>&1 & )
    for _ in $(seq 1 50); do
      curl -sf "http://127.0.0.1:$port/$probe" >/dev/null 2>&1 && break
      sleep 0.1
    done
  fi
  # A hard failure: a repository nothing is serving produces the same 404 as the archived suite
  # this page is about, so a silent bind failure would read as the page being right.
  if ! curl -sf "http://127.0.0.1:$port/$probe" >/dev/null 2>&1; then
    echo "repository-does-not-have-a-release-file: nothing serving $dir on 127.0.0.1:$port" >&2
    exit 1
  fi
}

serve 8086 "$MIRROR" dists/stable/InRelease
serve 8087 "$ARCHIVE" dists/buster/InRelease
serve 8088 "$FLAT" InRelease

# The state the page opens on: a source asking the mirror for a suite the mirror has retired.
cat > /etc/apt/sources.list.d/tips.sources <<'EOF'
Types: deb
URIs: http://deb.tips-mirror.example:8086
Suites: buster
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
chmod 644 /etc/apt/sources.list.d/tips.sources

# Any other source file an example writes is gone by the next one, because this is the whole set.
find /etc/apt/sources.list.d -name '*.sources' ! -name 'tips.sources' -delete

# Lists from a previous example's working source would leave a later one reporting a package it
# can no longer see the repository for.
rm -rf /var/lib/apt/lists
mkdir -p /var/lib/apt/lists/partial
