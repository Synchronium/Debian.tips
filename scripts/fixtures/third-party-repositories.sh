#!/usr/bin/env bash
# Fixtures for content/debian/third-party-repositories.md.
#
# Builds an actual signed third-party repository and serves it on 127.0.0.1:8081, so the
# page's outputs come from apt really verifying a real signature rather than from a
# description of what that would look like. The vendor publishes two packages: its own
# `hello-tips`, and a `curl` at version 99.0-1, which is the point the page is making.
#
# Every step is guarded. This script runs again before each documented output, and building
# packages and generating a signing key on each would dominate the run.
#
# The page documents states that are mutually exclusive on one machine: repository absent,
# present, and pinned. This leaves the sandbox in the "present, unpinned" state, which is the
# one the page's warning is about; the others are marked `verify: skip` on the page.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive
umask 0022

REPO=/srv/repo
KEY_EMAIL=packages@example.com

# This page's own blocks add a repository and pin it, and the restore between blocks only empties
# the working directory. So both directories are swept back to what the image ships before the
# ones this page wants are written below, or a block sees what the block before it added.
find /etc/apt/sources.list.d -name '*.sources' ! -name 'debian.sources' -delete 2>/dev/null
rm -f /etc/apt/preferences.d/*

build_package() {
  # name, version, section, description
  local name=$1 version=$2 description=$3
  local root=/build/$name
  rm -rf "$root"
  mkdir -p "$root/DEBIAN"
  cat > "$root/DEBIAN/control" <<CTL
Package: $name
Version: $version
Section: utils
Priority: optional
Architecture: all
Maintainer: Example Vendor <$KEY_EMAIL>
Description: $description
CTL
  dpkg-deb --build --root-owner-group "$root" "$REPO/pool/main/${name}_${version}_all.deb" >/dev/null
}

if [ ! -f "$REPO/dists/stable/InRelease" ]; then
  mkdir -p "$REPO/pool/main" "$REPO/dists/stable/main/binary-all"
  build_package hello-tips 1.0-1 "Demonstration package from a third-party repository"
  # Architecture: all throughout, so no output on the page names a machine's architecture.
  build_package curl 99.0-1 "Not the curl you were looking for"

  ( cd "$REPO"
    apt-ftparchive packages pool > dists/stable/main/binary-all/Packages
    gzip -kf dists/stable/main/binary-all/Packages
    apt-ftparchive -o APT::FTPArchive::Release::Origin=ExampleVendor \
      -o APT::FTPArchive::Release::Suite=stable \
      -o APT::FTPArchive::Release::Codename=stable \
      -o APT::FTPArchive::Release::Components=main \
      -o APT::FTPArchive::Release::Architectures=all \
      release dists/stable > dists/stable/Release )

  gpg --batch --quiet --passphrase "" --pinentry-mode loopback \
    --quick-generate-key "Example Vendor <$KEY_EMAIL>" default default never
  gpg --armor --export "$KEY_EMAIL" > "$REPO/vendor-key.asc"
  # --local-user, not the keyring default: naming the key means this signs with the key it just
  # generated whatever else the keyring holds. Relying on the default was a real defect, found
  # when a second page started building a repository of its own, and its symptom is worth
  # knowing because it points nowhere near the cause: apt reports the repository as unsigned and
  # names a key id that appears nowhere on the system.
  gpg --batch --yes --local-user "$KEY_EMAIL" --clearsign -o "$REPO/dists/stable/InRelease" "$REPO/dists/stable/Release"
fi

# Served over HTTP rather than file:// so the URLs the page prints are ones a reader could
# actually type. 127.0.0.1 for the same reason the curl and wget pages use it: what
# `localhost` resolves to is a property of the reader's machine.
#
# Port 8081, not 8080, which scripts/fixtures/http-mock.py uses. Only this page's own listener
# can reach this port now, but the check below stays a hard failure: a bind that fails silently
# leaves apt finding no repository, which reads as a page that has drifted rather than as a
# fixture that never came up.
if ! curl -sf http://127.0.0.1:8081/dists/stable/InRelease >/dev/null 2>&1; then
  ( python3 -m http.server 8081 --directory "$REPO" --bind 127.0.0.1 >/dev/null 2>&1 & )
  for _ in $(seq 1 50); do
    curl -sf http://127.0.0.1:8081/dists/stable/InRelease >/dev/null 2>&1 && break
    sleep 0.1
  done
fi

if ! curl -sf http://127.0.0.1:8081/dists/stable/InRelease >/dev/null 2>&1; then
  echo "third-party-repositories: nothing serving the repository on 127.0.0.1:8081" >&2
  exit 1
fi

# The vendor's key, scoped to the vendor's repository by Signed-By. Armoured rather than
# dearmored, because the page's point is that apt reads that form directly.
cp "$REPO/vendor-key.asc" /etc/apt/keyrings/example-vendor.asc
chmod 644 /etc/apt/keyrings/example-vendor.asc

cat > /etc/apt/sources.list.d/example.sources <<'EOF'
Types: deb
URIs: http://127.0.0.1:8081
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/example-vendor.asc
EOF
chmod 644 /etc/apt/sources.list.d/example.sources

# No pin: the page's warning is about what an unpinned third-party repository can do.
rm -f /etc/apt/preferences.d/example-vendor

# Snapshot comments are an artifact of the container image, not something a reader has.
sed -i '/^# http:\/\/snapshot\.debian\.org/d' /etc/apt/sources.list.d/debian.sources

apt_update_once
