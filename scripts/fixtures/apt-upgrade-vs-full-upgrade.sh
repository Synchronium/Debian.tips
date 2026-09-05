#!/usr/bin/env bash
# Fixtures for content/compare/apt-upgrade-vs-full-upgrade.md.
#
# Builds a signed repository on 127.0.0.1:8083 holding one upgrade that `upgrade` will not
# perform and `full-upgrade` will:
#
#   tips-app 1.0-1               no dependencies                  <- installed
#   tips-app 2.0-1               Depends: tips-lib                <- the available upgrade
#   tips-lib 1.0-1               Conflicts: tips-legacy           <- new, and displaces one
#   tips-legacy 1.0-1            no dependencies                  <- installed
#
#   tips-tool 1.0-1              no dependencies                  <- installed
#   tips-tool 2.0-1              Depends: tips-helper             <- the available upgrade
#   tips-helper 1.0-1            no dependencies                  <- new, displaces nothing
#
# Two chains, because the three commands the page compares fall into three groups rather than
# two, and one chain cannot show that. Reaching tips-tool 2.0-1 needs a package installed;
# reaching tips-app 2.0-1 needs one installed and another removed. `apt-get upgrade` refuses
# both, `apt upgrade` performs the first and refuses the second, and `full-upgrade` performs
# both. With only the tips-app chain the first two commands would look identical.
#
# Every step is guarded. This runs again before each documented output, and building six
# packages and a signing key each time would dominate the run.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive
umask 0022

REPO=/srv/upgrades
KEY_EMAIL=upgrades@example.com

# apt prints "not a stable CLI interface" whenever stdout is not a terminal, which here it never
# is. A reader running these at a prompt does not see it, so capturing it would document a line
# the page's audience cannot reproduce.
cat > /etc/apt/apt.conf.d/99-replay-no-script-warning <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

build_package() {
  # name, version, description, [depends], [conflicts]
  local name=$1 version=$2 description=$3 depends=${4:-} conflicts=${5:-}
  local root=/build/up-$name-$version
  rm -rf "$root"
  mkdir -p "$root/DEBIAN"
  {
    echo "Package: $name"
    echo "Version: $version"
    echo "Section: utils"
    echo "Priority: optional"
    # Architecture: all throughout, so nothing this page prints names a machine's architecture;
    # see test/architecture.test.ts.
    echo "Architecture: all"
    echo "Maintainer: Example <$KEY_EMAIL>"
    [ -n "$depends" ] && echo "Depends: $depends"
    [ -n "$conflicts" ] && echo "Conflicts: $conflicts"
    echo "Description: $description"
  } > "$root/DEBIAN/control"
  dpkg-deb --build --root-owner-group "$root" "$REPO/pool/main/${name}_${version}_all.deb" >/dev/null
}

if [ ! -f "$REPO/dists/stable/InRelease" ]; then
  mkdir -p "$REPO/pool/main" "$REPO/dists/stable/main/binary-all"
  build_package tips-app 1.0-1 "Demonstration application, first version"
  build_package tips-app 2.0-1 "Demonstration application, needing a library" tips-lib
  build_package tips-lib 1.0-1 "The library tips-app 2.0 needs" "" tips-legacy
  build_package tips-legacy 1.0-1 "The package the new library displaces"
  build_package tips-tool 1.0-1 "Demonstration tool, first version"
  build_package tips-tool 2.0-1 "Demonstration tool, needing a helper" tips-helper
  build_package tips-helper 1.0-1 "The helper tips-tool 2.0 needs, displacing nothing"

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
  gpg --armor --export "$KEY_EMAIL" > "$REPO/repo-key.asc"
  gpg --batch --yes --local-user "$KEY_EMAIL" --clearsign -o "$REPO/dists/stable/InRelease" "$REPO/dists/stable/Release"
fi

# Port 8083, distinct from the other fixtures that serve HTTP. A silent bind failure leaves apt
# with no repository to read, which on this page reads as an upgrade that stopped being pending.
if ! curl -sf http://127.0.0.1:8083/dists/stable/InRelease >/dev/null 2>&1; then
  ( python3 -m http.server 8083 --directory "$REPO" --bind 127.0.0.1 >/dev/null 2>&1 & )
  for _ in $(seq 1 50); do
    curl -sf http://127.0.0.1:8083/dists/stable/InRelease >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
if ! curl -sf http://127.0.0.1:8083/dists/stable/InRelease >/dev/null 2>&1; then
  echo "apt-upgrade-vs-full-upgrade: nothing serving the repository on 127.0.0.1:8083" >&2
  exit 1
fi

mkdir -p /etc/apt/keyrings
cp "$REPO/repo-key.asc" /etc/apt/keyrings/upgrades.asc
chmod 644 /etc/apt/keyrings/upgrades.asc

cat > /etc/apt/sources.list.d/upgrades.sources <<'EOF'
Types: deb
URIs: http://127.0.0.1:8083
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/upgrades.asc
EOF
chmod 644 /etc/apt/sources.list.d/upgrades.sources

# Snapshot comments are an artifact of the container image, not something a reader has.
sed -i '/^# http:\/\/snapshot\.debian\.org/d' /etc/apt/sources.list.d/debian.sources

# Always rebuilt here rather than once per page: this page's own source is what creates the
# pending upgrade, so a stale list is the difference between the demonstration and no
# demonstration at all.
apt-get update >/dev/null 2>&1
: > "$APT_UPDATED_MARKER"

# The starting state every example assumes: both old versions installed, tips-legacy alongside
# them, and neither new package present. Asserted rather than assumed, because every example on
# the page is a simulation and would report nothing to do if a real install had ever run.
if ! dpkg -s tips-app 2>/dev/null | grep -q '^Version: 1.0-1' ||
   ! dpkg -s tips-tool 2>/dev/null | grep -q '^Version: 1.0-1' ||
   ! dpkg -s tips-legacy >/dev/null 2>&1; then
  apt-get install -y --allow-downgrades \
    tips-app=1.0-1 tips-tool=1.0-1 tips-legacy=1.0-1 >/dev/null 2>&1
fi
for pkg in tips-lib tips-helper; do
  if dpkg -s "$pkg" >/dev/null 2>&1; then
    apt-get remove -y "$pkg" >/dev/null 2>&1
  fi
done
