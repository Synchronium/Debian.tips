#!/usr/bin/env bash
# Fixtures for content/troubleshooting/repository-is-not-signed.md.
#
# Builds a real signed repository on 127.0.0.1:8083 and then points apt at it with the WRONG
# key, which is the whole page: apt refuses the repository, and the reader needs to know that
# this is a verification failure rather than a network or configuration one.
#
# Two keys are generated deliberately — the one that signs the repository, and an unrelated one
# installed as its Signed-By keyring. Signing with a real key and verifying against a real but
# different key is the only way to get apt's genuine message rather than an approximation.

export DEBIAN_FRONTEND=noninteractive
umask 0022

REPO=/srv/unsigned
GOOD_EMAIL=goodkey@example.com
WRONG_EMAIL=wrongkey@example.com

find /etc/apt/sources.list.d -name '*.sources' ! -name 'debian.sources' -delete 2>/dev/null
rm -f /etc/apt/preferences.d/*

# Silence apt's "not a stable CLI interface" warning; see scripts/fixtures/apt.sh for why this
# is the default for pages running apt.
cat > /etc/apt/apt.conf.d/99-replay-no-script-warning <<'EOF'
APT::Cmd::Disable-Script-Warning "1";
EOF

if ! command -v apt-ftparchive >/dev/null 2>&1; then
  apt-get update >/dev/null 2>&1
  apt-get install -y gnupg apt-utils >/dev/null 2>&1
fi

if [ ! -f "$REPO/dists/stable/InRelease" ]; then
  mkdir -p "$REPO/pool/main" "$REPO/dists/stable/main/binary-all"
  root=/build/signing-demo
  rm -rf "$root"; mkdir -p "$root/DEBIAN"
  cat > "$root/DEBIAN/control" <<CTL
Package: signing-demo
Version: 1.0-1
Section: utils
Priority: optional
Architecture: all
Maintainer: Example <$GOOD_EMAIL>
Description: Demonstration package behind a signature the machine cannot verify
CTL
  dpkg-deb --build --root-owner-group "$root" "$REPO/pool/main/signing-demo_1.0-1_all.deb" >/dev/null

  ( cd "$REPO"
    apt-ftparchive packages pool > dists/stable/main/binary-all/Packages
    gzip -kf dists/stable/main/binary-all/Packages
    apt-ftparchive -o APT::FTPArchive::Release::Origin=Example \
      -o APT::FTPArchive::Release::Suite=stable \
      -o APT::FTPArchive::Release::Codename=stable \
      -o APT::FTPArchive::Release::Components=main \
      -o APT::FTPArchive::Release::Architectures=all \
      release dists/stable > dists/stable/Release )

  for email in "$GOOD_EMAIL" "$WRONG_EMAIL"; do
    gpg --batch --quiet --passphrase "" --pinentry-mode loopback \
      --quick-generate-key "Example <$email>" default default never
  done
  gpg --armor --export "$GOOD_EMAIL"  > "$REPO/good-key.asc"
  gpg --armor --export "$WRONG_EMAIL" > "$REPO/wrong-key.asc"
  # --local-user rather than the keyring default: two keys exist here by design, and every
  # other page's fixture may have added more into the same sandbox.
  gpg --batch --yes --local-user "$GOOD_EMAIL" --clearsign \
    -o "$REPO/dists/stable/InRelease" "$REPO/dists/stable/Release"
fi

# Port 8083: 8080 is the curl/wget mock, 8081 third-party-repositories, 8082 packages-kept-back,
# and a full `npm run replay` shares one sandbox between all of them.
if ! curl -sf http://127.0.0.1:8083/dists/stable/InRelease >/dev/null 2>&1; then
  ( python3 -m http.server 8083 --directory "$REPO" --bind 127.0.0.1 >/dev/null 2>&1 & )
  for _ in $(seq 1 50); do
    curl -sf http://127.0.0.1:8083/dists/stable/InRelease >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
if ! curl -sf http://127.0.0.1:8083/dists/stable/InRelease >/dev/null 2>&1; then
  echo "repository-is-not-signed: nothing serving the repository on 127.0.0.1:8083" >&2
  exit 1
fi

# The wrong key installed as the repository's keyring. Everything else here is correct — the
# URL resolves, the repository is real, the signature is valid — so the only thing apt can
# object to is that this key did not make that signature.
mkdir -p /etc/apt/keyrings
cp "$REPO/wrong-key.asc" /etc/apt/keyrings/signing-demo.asc
chmod 644 /etc/apt/keyrings/signing-demo.asc

# The correct key is left where the page's fix can fetch it, standing in for the vendor's
# published key URL.
cp "$REPO/good-key.asc" "$REPO/published-key.asc"

cat > /etc/apt/sources.list.d/signing-demo.sources <<'EOF'
Types: deb
URIs: http://127.0.0.1:8083
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/signing-demo.asc
EOF
chmod 644 /etc/apt/sources.list.d/signing-demo.sources

sed -i '/^# http:\/\/snapshot\.debian\.org/d' /etc/apt/sources.list.d/debian.sources

# Drop any cached index for this repository, so every example starts from a machine that has
# never successfully fetched it. apt says different things otherwise: the first failure is
# "E: The repository is not signed", and a later one is the softer "previous index files will
# be used", because there is now a previous index to fall back on. The page documents the
# first, which is what a reader adding a repository actually sees.
rm -rf /var/lib/apt/lists/127.0.0.1:8083* 2>/dev/null

# No `apt-get update` here: running it is what the page's first example does, and its failure
# is the output being documented.
echo repository-is-not-signed > /var/lib/apt/.fixture-page
