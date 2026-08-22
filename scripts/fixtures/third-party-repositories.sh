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

export DEBIAN_FRONTEND=noninteractive
umask 0022

REPO=/srv/repo
KEY_EMAIL=packages@example.com

# Other prose pages' setups also configure apt, and `npm run replay` runs every page in one
# sandbox, so a source left behind by an earlier page changes what this one sees. Each page
# normalises the sources and preferences directories to exactly what it needs.
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
  # --local-user, not the keyring default: `npm run replay` runs every page in one sandbox,
  # and any other page that generates a signing key would otherwise become the default and
  # sign this repository with the wrong one. apt then reports the repository as unsigned,
  # naming a key id that appears nowhere. Exactly that happened when packages-kept-back
  # started building a repository of its own.
  gpg --batch --yes --local-user "$KEY_EMAIL" --clearsign -o "$REPO/dists/stable/InRelease" "$REPO/dists/stable/Release"
fi

# Served over HTTP rather than file:// so the URLs the page prints are ones a reader could
# actually type. 127.0.0.1 for the same reason the curl and wget pages use it: what
# `localhost` resolves to is a property of the reader's machine.
#
# Port 8081, not 8080. The curl, wget, awk, sed, grep and diff pages start
# scripts/fixtures/http-mock.py on 8080 and nothing stops it afterwards, so in a full
# `npm run replay` (one sandbox, every page in turn) 8080 is already taken by the time this
# page runs. Alone it passed; in the batch the bind failed silently and apt found no
# repository. Hence the hard failure below rather than another silent one.
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

# Rebuilt when the previous page left different sources configured, which is once per page
# rather than once per documented output.
STATE=/var/lib/apt/.fixture-page
if [ "$(cat $STATE 2>/dev/null)" != "third-party-repositories" ]; then
  apt-get update >/dev/null 2>&1
  echo third-party-repositories > $STATE
fi
