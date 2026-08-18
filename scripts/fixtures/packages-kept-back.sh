#!/usr/bin/env bash
# Fixtures for content/troubleshooting/packages-kept-back.md.
#
# Builds a real signed repository on 127.0.0.1:8082 that reproduces the actual cause of
# "The following packages have been kept back": an upgrade that needs a *new* package.
#
#   tips-demo 1.0-1              no dependencies       <- installed
#   tips-demo 2.0-1              Depends: tips-extra   <- the available upgrade
#   tips-extra 1.0-1             the new package the upgrade needs
#
# `apt-get upgrade` refuses to install new packages, so it holds tips-demo back rather than
# pulling tips-extra in. That is the whole error, and reproducing it is the only way to show
# the reader the real message rather than a description of it.
#
# Every step is guarded: this runs again before each documented output, and building packages
# and generating a signing key each time would dominate the run.

export DEBIAN_FRONTEND=noninteractive
umask 0022

REPO=/srv/keptback
KEY_EMAIL=keptback@example.com

# Other pages' setups also configure apt and `npm run replay` runs them all in one sandbox.
find /etc/apt/sources.list.d -name '*.sources' ! -name 'debian.sources' -delete 2>/dev/null
rm -f /etc/apt/preferences.d/*

# Silence apt's "not a stable CLI interface" warning, which it prints whenever stdout is not
# a terminal — always, in this harness. A reader running these commands at a prompt never sees
# it, so capturing it would document a line the page's own audience cannot reproduce. This is
# the default for any page running `apt`; /compare/apt-vs-apt-get/ is the one page that removes
# this file, because there the warning is the subject.
cat > /etc/apt/apt.conf.d/99-replay-no-script-warning <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

if ! command -v apt-ftparchive >/dev/null 2>&1; then
  apt-get update >/dev/null 2>&1
  apt-get install -y gnupg apt-utils >/dev/null 2>&1
fi

build_package() {
  # name, version, description, [depends]
  local name=$1 version=$2 description=$3 depends=${4:-}
  local root=/build/kb-$name-$version
  rm -rf "$root"
  mkdir -p "$root/DEBIAN"
  {
    echo "Package: $name"
    echo "Version: $version"
    echo "Section: utils"
    echo "Priority: optional"
    # Architecture: all throughout, so nothing this page prints names a machine's
    # architecture — see test/architecture.test.ts.
    echo "Architecture: all"
    echo "Maintainer: Example <$KEY_EMAIL>"
    [ -n "$depends" ] && echo "Depends: $depends"
    echo "Description: $description"
  } > "$root/DEBIAN/control"
  dpkg-deb --build --root-owner-group "$root" "$REPO/pool/main/${name}_${version}_all.deb" >/dev/null
}

if [ ! -f "$REPO/dists/stable/InRelease" ]; then
  mkdir -p "$REPO/pool/main" "$REPO/dists/stable/main/binary-all"
  build_package tips-demo 1.0-1 "Demonstration package, first version"
  build_package tips-demo 2.0-1 "Demonstration package, needing a new dependency" tips-extra
  build_package tips-extra 1.0-1 "The new dependency tips-demo 2.0 pulls in"

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

# Port 8082: 8080 is the curl/wget mock server and 8081 is third-party-repositories, and in a
# full `npm run replay` all three pages share one sandbox. A silent bind failure here would
# look like a page that had drifted, so the check below is a hard failure.
if ! curl -sf http://127.0.0.1:8082/dists/stable/InRelease >/dev/null 2>&1; then
  ( python3 -m http.server 8082 --directory "$REPO" --bind 127.0.0.1 >/dev/null 2>&1 & )
  for _ in $(seq 1 50); do
    curl -sf http://127.0.0.1:8082/dists/stable/InRelease >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
if ! curl -sf http://127.0.0.1:8082/dists/stable/InRelease >/dev/null 2>&1; then
  echo "packages-kept-back: nothing serving the repository on 127.0.0.1:8082" >&2
  exit 1
fi

mkdir -p /etc/apt/keyrings
cp "$REPO/repo-key.asc" /etc/apt/keyrings/keptback.asc
chmod 644 /etc/apt/keyrings/keptback.asc

cat > /etc/apt/sources.list.d/keptback.sources <<'EOF'
Types: deb
URIs: http://127.0.0.1:8082
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/keptback.asc
EOF
chmod 644 /etc/apt/sources.list.d/keptback.sources

# Snapshot comments are an artifact of the container image, not something a reader has.
sed -i '/^# http:\/\/snapshot\.debian\.org/d' /etc/apt/sources.list.d/debian.sources

# Always rebuild the lists here rather than once per page: this page's own source is what
# creates the pending upgrade, so a stale list is the difference between the error and no
# error at all.
apt-get update >/dev/null 2>&1
echo packages-kept-back > /var/lib/apt/.fixture-page

# tips-demo pinned at 1.0-1, so the upgrade to 2.0-1 is always pending. Reinstalled rather
# than left alone, because the examples upgrade it for real and fixtures are restored by
# re-running this script.
if ! dpkg -s tips-demo 2>/dev/null | grep -q '^Version: 1.0-1'; then
  apt-get install -y --allow-downgrades tips-demo=1.0-1 >/dev/null 2>&1
fi
if dpkg -s tips-extra >/dev/null 2>&1; then
  apt-get purge -y tips-extra >/dev/null 2>&1
fi

# tips-demo must never be held: a hold produces the same "kept back" message, which would make
# the dependency cause the page is actually demonstrating impossible to tell apart.
apt-mark unhold tips-demo >/dev/null 2>&1

# ca-certificates held instead, so the hold example has something real to list. Chosen because
# it has no upgrade pending — holding a package that does (libexpat1, here) would add it to the
# kept-back list and change the output of every other example on the page.
apt-mark hold ca-certificates >/dev/null 2>&1
