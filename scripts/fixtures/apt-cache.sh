#!/usr/bin/env bash
# Fixtures for content/commands/apt-cache/.
#
# The page's sample data is the package cache itself, so this puts the sandbox into the states
# the examples read: two Debian packages on either side of the installed/not-installed line,
# and a second repository offering a version Debian does not have.
#
# Every step is guarded. This script runs again before each documented output, and building a
# package and re-indexing a repository on each would dominate the run.

export DEBIAN_FRONTEND=noninteractive
umask 0022

VENDOR=/srv/vendor

# Architecture: all on both sides of every version this page prints. `apt-cache policy` names
# the index a version came from, and a Debian index is per-architecture: the line reads
# "trixie/main arm64 Packages" here and "amd64" on a CI runner. The vendor repository below
# declares Architectures=all, so its line reads "all Packages" everywhere, which is what lets
# this page show a version table at all. See test/architecture.test.ts.
build_package() {
  # name, version, description
  local root=/build/$1
  rm -rf "$root"
  mkdir -p "$root/DEBIAN"
  cat > "$root/DEBIAN/control" <<CTL
Package: $1
Version: $2
Section: utils
Priority: optional
Architecture: all
Maintainer: Example Vendor <packages@example.com>
Description: $3
CTL
  dpkg-deb --build --root-owner-group "$root" "$VENDOR/pool/main/$1_$2_all.deb" >/dev/null
}

if [ ! -f "$VENDOR/dists/stable/Release" ]; then
  mkdir -p "$VENDOR/pool/main" "$VENDOR/dists/stable/main/binary-all"
  # An epoch, because Debian's bash-completion carries one and apt compares epochs before it
  # compares anything else. A vendor version of 99.0-1 would lose to 1:2.16.0-7, and the page
  # would show a repository that cannot win as though it had.
  build_package bash-completion 1:99.0-1 "Vendor build of the bash completion library"
  build_package hello-tips 1.0-1 "Demonstration package from a repository Debian does not carry"

  ( cd "$VENDOR"
    apt-ftparchive packages pool > dists/stable/main/binary-all/Packages
    apt-ftparchive -o APT::FTPArchive::Release::Origin=ExampleVendor \
      -o APT::FTPArchive::Release::Suite=stable \
      -o APT::FTPArchive::Release::Codename=stable \
      -o APT::FTPArchive::Release::Components=main \
      -o APT::FTPArchive::Release::Architectures=all \
      release dists/stable > dists/stable/Release )
fi

# file:// rather than a listener, so this page holds no port and needs no signing key. The URI
# is what `apt-cache policy` prints, and a reader meets it in the fixtures block above the
# examples rather than having to guess where a second repository came from.
mkdir -p /etc/apt/sources.list.d
cat > /etc/apt/sources.list.d/vendor.sources <<'EOF'
Types: deb
URIs: file:/srv/vendor
Suites: stable
Components: main
Trusted: yes
EOF
chmod 644 /etc/apt/sources.list.d/vendor.sources

# Snapshot comments are an artifact of the container image, not something a reader has, and
# `apt-cache policy` with no package named prints the sources it read.
sed -i '/^# http:\/\/snapshot\.debian\.org/d' /etc/apt/sources.list.d/debian.sources

# Fetched once per container rather than once per documented output: this script runs before
# every one of them, and each fetch is seconds of network.
STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "apt-cache" ]; then
  apt-get update >/dev/null 2>&1
  echo apt-cache > $STATE
fi

# cowsay installed and cowsay-off absent: the pair the policy, depends and rdepends examples
# read. Both are Architecture: all and neither has moved in the archive for years, which is
# what keeps a page that prints their version numbers reproducible.
if ! dpkg -s cowsay >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends cowsay >/dev/null 2>&1
fi
if dpkg -s cowsay-off >/dev/null 2>&1; then
  apt-get purge -y cowsay-off >/dev/null 2>&1
fi

# Debian's bash-completion installed, so the version table example has an installed version to
# put beside the vendor's candidate. The `/trixie` suffix names the suite, without which apt
# would resolve the higher-versioned vendor package and the two lines would agree.
if ! dpkg -s bash-completion >/dev/null 2>&1; then
  apt-get install -y bash-completion/trixie >/dev/null 2>&1
fi

# hello-tips absent, so the examples that read a package only the vendor carries plan against
# it rather than reporting it installed.
if dpkg -s hello-tips >/dev/null 2>&1; then
  apt-get purge -y hello-tips >/dev/null 2>&1
fi
