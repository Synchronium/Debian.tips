#!/usr/bin/env bash
# Fixtures for content/troubleshooting/unmet-dependencies.md.
#
# One signed repository on 127.0.0.1:8089, holding a set of packages chosen so that each of the
# three ways apt words this failure can be produced on demand:
#
#   tips-lib     1.0-1 and 2.0-1       the dependency that exists and is blocked
#   tips-app     Depends: tips-lib (>= 2.0)
#   tips-editor  Depends: tips-spell   nothing anywhere provides tips-spell
#   tips-alpha   Conflicts: tips-beta
#   tips-beta    Conflicts: tips-alpha
#   tips-suite   Depends: tips-alpha, tips-beta   asks for both sides of that conflict
#
# The state every example starts from is tips-lib 1.0-1 installed and held, which is what makes
# `apt install tips-app` fail with a dependency that is sitting in the repository.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive
umask 0022

REPO=/srv/tips-deps
KEY_EMAIL=deps@example.com

# Debian's own sources are removed: every example here runs apt and prints what it says, so a
# source pointing at the real archive would put the archive's current contents in the output.
rm -f /etc/apt/sources.list.d/debian.sources
rm -f /etc/apt/preferences.d/*

cat > /etc/apt/apt.conf.d/99-replay-unmet-deps <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

grep -q tips-vendor.example /etc/hosts || echo '127.0.0.1 packages.tips-vendor.example' >> /etc/hosts

build_package() {
  # name, version, depends, conflicts
  local name=$1 version=$2 depends=$3 conflicts=$4
  local root=/build/$name-$version
  rm -rf "$root"
  mkdir -p "$root/DEBIAN"
  {
    echo "Package: $name"
    echo "Version: $version"
    echo "Section: utils"
    echo "Priority: optional"
    # Architecture: all throughout, so no output on this page names a machine's architecture;
    # see test/architecture.test.ts. apt's own solver explanation does name one, which is why
    # the page reads the two streams separately and quotes only standard output.
    echo "Architecture: all"
    echo "Maintainer: Example <$KEY_EMAIL>"
    [ -n "$depends" ] && echo "Depends: $depends"
    [ -n "$conflicts" ] && echo "Conflicts: $conflicts"
    echo "Description: Demonstration package $name"
  } > "$root/DEBIAN/control"
  dpkg-deb --build --root-owner-group "$root" "$REPO/pool/main/${name}_${version}_all.deb" >/dev/null
}

# Guarded as a whole: this runs again before every documented output, and rebuilding seven
# packages and a signing key each time would dominate the page's replay.
if [ ! -f "$REPO/dists/stable/InRelease" ]; then
  mkdir -p "$REPO/pool/main" "$REPO/dists/stable/main/binary-all"
  build_package tips-lib 1.0-1 "" ""
  build_package tips-lib 2.0-1 "" ""
  build_package tips-app 1.0-1 "tips-lib (>= 2.0)" ""
  build_package tips-editor 1.0-1 "tips-spell" ""
  build_package tips-alpha 1.0-1 "" "tips-beta"
  build_package tips-beta 1.0-1 "" "tips-alpha"
  build_package tips-suite 1.0-1 "tips-alpha, tips-beta" ""

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
fi

# A silent bind failure would leave apt with no repository at all, and every example would then
# report a package that cannot be found rather than one that cannot be resolved.
if ! curl -sf http://127.0.0.1:8089/dists/stable/InRelease >/dev/null 2>&1; then
  ( python3 -m http.server 8089 --directory "$REPO" --bind 127.0.0.1 >/dev/null 2>&1 & )
  for _ in $(seq 1 50); do
    curl -sf http://127.0.0.1:8089/dists/stable/InRelease >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
if ! curl -sf http://127.0.0.1:8089/dists/stable/InRelease >/dev/null 2>&1; then
  echo "unmet-dependencies: nothing serving the repository on 127.0.0.1:8089" >&2
  exit 1
fi

cat > /etc/apt/sources.list.d/tips.sources <<'EOF'
Types: deb
URIs: http://packages.tips-vendor.example:8089
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
chmod 644 /etc/apt/sources.list.d/tips.sources
find /etc/apt/sources.list.d -name '*.sources' ! -name 'tips.sources' -delete

apt_update_once

# Package state survives the restore, and this page's examples install, remove and unhold things,
# so the starting state is asserted rather than assumed. Purging first is what lets an example
# succeed at installing tips-app without the next example finding it already there.
apt-mark unhold tips-lib tips-app tips-editor tips-suite tips-alpha tips-beta >/dev/null 2>&1
dpkg --purge --force-all tips-app tips-editor tips-suite tips-alpha tips-beta tips-lib >/dev/null 2>&1

# tips-lib held one major version below what tips-app asks for. Held rather than merely old,
# because an old version on its own is not a failure: apt would upgrade it and carry on.
apt-get install -y --allow-downgrades tips-lib=1.0-1 >/dev/null 2>&1
apt-mark hold tips-lib >/dev/null

if ! apt-mark showhold | grep -q '^tips-lib$'; then
  echo "unmet-dependencies: tips-lib is not held, so nothing blocks tips-app" >&2
  exit 1
fi
