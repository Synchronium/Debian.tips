#!/usr/bin/env bash
# Fixtures for content/troubleshooting/apt-update-failed.md.
#
# Builds the machine the page diagnoses: two real signed repositories, one still serving and one
# that has gone away since it was last fetched. That second state is the page's subject, because
# it is the one apt reports as a warning and then carries on from, leaving a list on disk that is
# older than the machine believes.
#
#   packages.tips-vendor.example:8084   serving        tips-agent 1.0-1
#   apt.tips-legacy.example:8085        fetched, then stopped   tips-monitor 1.0-1
#
# Both names are /etc/hosts aliases for 127.0.0.1. Two names rather than two ports on one name,
# because apt queues its fetches per host: a source that refuses a connection fails every other
# source sharing its hostname, with errors naming the wrong port.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive
umask 0022

VENDOR_REPO=/srv/tips-vendor
LEGACY_REPO=/srv/tips-legacy
KEY_EMAIL=repos@example.com

# Debian's own sources are removed rather than left alone: every example here runs `apt update`
# and prints what it says, so a source pointing at the real archive would put the archive's
# current contents, and its transfer sizes, into the page's output.
rm -f /etc/apt/sources.list.d/debian.sources
rm -f /etc/apt/preferences.d/*

# Two settings the page's output depends on, neither of which it is teaching.
#
# Retries::Delay is the backoff between apt's three attempts at a source. It costs seven seconds
# on a refused connection, which is over the harness's per-example limit, and it changes no line
# of what apt prints.
#
# The script warning is apt's "not a stable CLI interface" line, printed whenever stdout is not a
# terminal, which in this harness is always. A reader running these at a prompt never sees it.
#
# Not Acquire::Queue-Mode "access", which is the other way to make the order deterministic and
# costs the page a line it teaches. It puts every source in one queue on one connection, so a
# source behind the refused one is reported unreachable when it is serving, and a source in front
# of it survives while the refused one's reason lines report the port that connection last used.
# Both were measured against this fixture. Sharing one hostname between the two repositories has
# the same second fault, which is why they have a name each.
cat > /etc/apt/apt.conf.d/99-replay-update-failed <<'EOF'
Acquire::Retries::Delay "false";
APT::Cmd::Disable-Script-Warning "1";
EOF

grep -q tips-vendor.example /etc/hosts || cat >> /etc/hosts <<'EOF'
127.0.0.1 packages.tips-vendor.example
127.0.0.1 apt.tips-legacy.example
EOF

build_package() {
  # repo, name, version, description
  local repo=$1 name=$2 version=$3 description=$4
  local root=/build/$name-$version
  rm -rf "$root"
  mkdir -p "$root/DEBIAN"
  {
    echo "Package: $name"
    echo "Version: $version"
    echo "Section: utils"
    echo "Priority: optional"
    # Architecture: all throughout, so no output on this page names a machine's architecture;
    # see test/architecture.test.ts.
    echo "Architecture: all"
    echo "Maintainer: Example <$KEY_EMAIL>"
    echo "Description: $description"
  } > "$root/DEBIAN/control"
  dpkg-deb --build --root-owner-group "$root" "$repo/pool/main/${name}_${version}_all.deb" >/dev/null
}

build_repo() {
  # repo, package name, package description
  local repo=$1 name=$2 description=$3
  mkdir -p "$repo/pool/main" "$repo/dists/stable/main/binary-all"
  build_package "$repo" "$name" 1.0-1 "$description"
  ( cd "$repo"
    apt-ftparchive packages pool > dists/stable/main/binary-all/Packages
    gzip -kf dists/stable/main/binary-all/Packages
    apt-ftparchive -o APT::FTPArchive::Release::Origin=Example \
      -o APT::FTPArchive::Release::Suite=stable \
      -o APT::FTPArchive::Release::Codename=stable \
      -o APT::FTPArchive::Release::Components=main \
      -o APT::FTPArchive::Release::Architectures=all \
      release dists/stable > dists/stable/Release )
  gpg --batch --yes --local-user "$KEY_EMAIL" --clearsign \
    -o "$repo/dists/stable/InRelease" "$repo/dists/stable/Release"
}

# Guarded as a whole: this runs again before every documented output, and building two packages
# and a signing key each time would dominate the page's replay.
#
# One key signs both repositories. The page never asks the reader to tell them apart by key, and
# the one page where a key is the subject is /troubleshooting/repository-is-not-signed/.
if [ ! -f "$VENDOR_REPO/dists/stable/InRelease" ]; then
  gpg --batch --quiet --passphrase "" --pinentry-mode loopback \
    --quick-generate-key "Example <$KEY_EMAIL>" default default never
  mkdir -p /etc/apt/keyrings
  gpg --armor --export "$KEY_EMAIL" > /etc/apt/keyrings/tips-repos.asc
  chmod 644 /etc/apt/keyrings/tips-repos.asc
  build_repo "$VENDOR_REPO" tips-agent "Demonstration package from the vendor repository"
  build_repo "$LEGACY_REPO" tips-monitor "Demonstration package from the repository that goes away"
fi

# The vendor repository answers its index slowly, which is what gives the transcript one order.
#
# apt gives each host a fetch queue and runs the queues at once, so two repositories report in
# whichever order they finish. A refused connection finishes in microseconds and an HTTP round
# trip does not, so the failing source usually reports first. Usually: one run in twelve here, and
# one on a CI runner, put `Hit:1` at the top of a page that documents `Ign:1` there. Neither the
# line order nor the numbers are apt's to promise, since the number is handed out as each fetch
# reports rather than fixed when the source is read.
#
# Two seconds against a refused connection is the margin, measured: at 0.75s a container with
# four times as many spinning processes as it had cores still flipped one run in ten, and the
# whole point of the delay is that no plausible amount of contention reaches it. The page says
# out loud that the order varies, so nobody is being taught a sequence their machine disagrees
# with; the delay only decides which of the true orders this page shows.
#
# It waits on one file, the index every example fetches, and only while the marker exists. Both
# narrowings are about the 5-second cap on an example: an unscoped delay would be paid twice by
# the example that adds a second suite, and paid again by the seeding update below, which runs
# before every example on the page and does not care what order it sees.
SLOW_MARKER=/run/tips-vendor-slow
rm -f "$SLOW_MARKER"
cat > /opt/tips-vendor-server.py <<'PY'
import functools
import http.server
import os
import sys
import time

INDEX = "/dists/stable/InRelease"
DELAY_SECONDS = 2
MARKER = "/run/tips-vendor-slow"


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        if self.path == INDEX and os.path.exists(MARKER):
            time.sleep(DELAY_SECONDS)
        return super().send_head()

    def log_message(self, *args):
        pass


port, directory = int(sys.argv[1]), sys.argv[2]
handler = functools.partial(Handler, directory=directory)
http.server.HTTPServer(("127.0.0.1", port), handler).serve_forever()
PY

# A silent bind failure would leave apt finding no repository at all, which reads on the page as
# drift rather than as a broken fixture, so this is a hard failure.
if ! curl -sf http://127.0.0.1:8084/dists/stable/InRelease >/dev/null 2>&1; then
  ( python3 /opt/tips-vendor-server.py 8084 "$VENDOR_REPO" >/dev/null 2>&1 & )
  for _ in $(seq 1 50); do
    curl -sf http://127.0.0.1:8084/dists/stable/InRelease >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
if ! curl -sf http://127.0.0.1:8084/dists/stable/InRelease >/dev/null 2>&1; then
  echo "apt-update-failed: nothing serving the vendor repository on 127.0.0.1:8084" >&2
  exit 1
fi

cat > /etc/apt/sources.list.d/tips-vendor.sources <<'EOF'
Types: deb
URIs: http://packages.tips-vendor.example:8084
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF

cat > /etc/apt/sources.list.d/tips-legacy.sources <<'EOF'
Types: deb
URIs: http://apt.tips-legacy.example:8085
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
chmod 644 /etc/apt/sources.list.d/*.sources

# Any source file an example adds is gone by the next one, because this is the whole set.
find /etc/apt/sources.list.d -name '*.sources' \
  ! -name 'tips-vendor.sources' ! -name 'tips-legacy.sources' -delete

# The legacy repository serves exactly long enough to be fetched once, and is then stopped. That
# is what leaves a list on disk for a source apt can no longer reach, which is the state every
# example on this page starts from: apt has an answer for `tips-monitor` and no way to check it.
#
# Rebuilt every run rather than once, because an example that runs `apt update` against the
# stopped repository is only telling the truth if the list it falls back on was fetched under
# this same fixture.
rm -rf /var/lib/apt/lists
mkdir -p /var/lib/apt/lists/partial
python3 -m http.server 8085 --directory "$LEGACY_REPO" --bind 127.0.0.1 >/dev/null 2>&1 &
legacy_pid=$!
for _ in $(seq 1 50); do
  curl -sf http://127.0.0.1:8085/dists/stable/InRelease >/dev/null 2>&1 && break
  sleep 0.1
done
apt-get update >/dev/null 2>&1
kill "$legacy_pid" 2>/dev/null
wait "$legacy_pid" 2>/dev/null

# Asserted rather than assumed: with no list for the legacy repository the page has no stale
# state to show, and every example would report a plain fetch failure instead.
if ! apt-cache policy tips-monitor 2>/dev/null | grep -q '1.0-1'; then
  echo "apt-update-failed: no list left behind for the legacy repository" >&2
  exit 1
fi

# Everything above this line is the fixture fetching its own index, and the example is next.
touch "$SLOW_MARKER"
