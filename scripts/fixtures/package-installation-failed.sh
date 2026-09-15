#!/usr/bin/env bash
# Fixtures for content/troubleshooting/package-installation-failed.md.
#
# One signed repository on 127.0.0.1:8090 whose index is deliberately out of step with its pool,
# which is the state behind both failures this page is about:
#
#   tips-tool     index and pool agree          installs
#   tips-gone     in the index, not in the pool  404 on the .deb
#   tips-corrupt  in the index, different bytes  size and hash mismatch
#
# The index is built while all three packages are present and is then left alone; the pool is
# broken afterwards. That ordering is the whole fixture: an index describing files that are no
# longer the files behind it is exactly what a mirror mid-sync, or a stale cache, produces.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive
umask 0022

REPO=/srv/tips-install
KEY_EMAIL=install@example.com

rm -f /etc/apt/sources.list.d/debian.sources
rm -f /etc/apt/preferences.d/*

cat > /etc/apt/apt.conf.d/99-replay-install-failed <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

grep -q tips-vendor.example /etc/hosts || echo '127.0.0.1 packages.tips-vendor.example' >> /etc/hosts

build_package() {
  local name=$1
  local root=/build/$name
  rm -rf "$root"
  mkdir -p "$root/DEBIAN" "$root/usr/share/$name"
  # Architecture: all, so no output on this page names a machine's architecture; see
  # test/architecture.test.ts.
  cat > "$root/DEBIAN/control" <<CTL
Package: $name
Version: 1.0-1
Section: utils
Priority: optional
Architecture: all
Maintainer: Example <$KEY_EMAIL>
Description: Demonstration package $name
CTL
  printf 'payload for %s\n' "$name" > "$root/usr/share/$name/data"
  dpkg-deb --build --root-owner-group "$root" "$REPO/pool/main/${name}_1.0-1_all.deb" >/dev/null
}

# Guarded as a whole: this runs again before every documented output, and rebuilding three
# packages and a signing key each time would dominate the page's replay.
#
# The guard is also what keeps the index's recorded hashes stable for the life of the container.
# `dpkg-deb` records file mtimes, so rebuilding produces different bytes and different hashes,
# which is why the page compares the mismatch line by shape rather than quoting a hash.
if [ ! -f "$REPO/dists/stable/InRelease" ]; then
  mkdir -p "$REPO/pool/main" "$REPO/dists/stable/main/binary-all"
  build_package tips-tool
  build_package tips-gone
  build_package tips-corrupt

  ( cd "$REPO"
    apt-ftparchive packages pool > dists/stable/main/binary-all/Packages
    gzip -kf dists/stable/main/binary-all/Packages
    apt-ftparchive -o APT::FTPArchive::Release::Origin=Example \
      -o APT::FTPArchive::Release::Suite=stable \
      -o APT::FTPArchive::Release::Codename=stable \
      -o APT::FTPArchive::Release::Components=main \
      -o APT::FTPArchive::Release::Architectures=all \
      release dists/stable > dists/stable/Release )

  gpg --batch --quiet --passphrase "" --pinentry-mode loopback \
    --quick-generate-key "Example <$KEY_EMAIL>" default default never
  mkdir -p /etc/apt/keyrings
  gpg --armor --export "$KEY_EMAIL" > /etc/apt/keyrings/tips-repos.asc
  chmod 644 /etc/apt/keyrings/tips-repos.asc
  gpg --batch --yes --local-user "$KEY_EMAIL" --clearsign \
    -o "$REPO/dists/stable/InRelease" "$REPO/dists/stable/Release"

  # Break the pool underneath the index, which is now signed and will not be regenerated.
  rm -f "$REPO/pool/main/tips-gone_1.0-1_all.deb"
  printf 'not the package the index describes\n' > "$REPO/pool/main/tips-corrupt_1.0-1_all.deb"
fi

if ! curl -sf http://127.0.0.1:8090/dists/stable/InRelease >/dev/null 2>&1; then
  ( python3 -m http.server 8090 --directory "$REPO" --bind 127.0.0.1 >/dev/null 2>&1 & )
  for _ in $(seq 1 50); do
    curl -sf http://127.0.0.1:8090/dists/stable/InRelease >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
if ! curl -sf http://127.0.0.1:8090/dists/stable/InRelease >/dev/null 2>&1; then
  echo "package-installation-failed: nothing serving the repository on 127.0.0.1:8090" >&2
  exit 1
fi

cat > /etc/apt/sources.list.d/tips.sources <<'EOF'
Types: deb
URIs: http://packages.tips-vendor.example:8090
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
chmod 644 /etc/apt/sources.list.d/tips.sources
find /etc/apt/sources.list.d -name '*.sources' ! -name 'tips.sources' -delete

apt_update_once

# Package state and the download cache both survive the restore, and an example here installs a
# package and another fills the cache with a file that failed verification.
dpkg --purge --force-all tips-tool tips-gone tips-corrupt >/dev/null 2>&1
apt-get clean

# Asserted rather than assumed: if the pool still held tips-gone, every example on this page would
# succeed and the page would document a failure nothing here can produce.
if curl -sf -o /dev/null http://127.0.0.1:8090/pool/main/tips-gone_1.0-1_all.deb; then
  echo "package-installation-failed: tips-gone is still in the pool, so nothing 404s" >&2
  exit 1
fi
