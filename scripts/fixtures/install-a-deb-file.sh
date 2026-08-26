#!/usr/bin/env bash
# Fixtures for content/debian/install-a-deb-file.md.
#
# The page's sample data is a `.deb` that came from outside the archive, so this builds one:
# a package apt has never heard of, with a dependency the machine does not satisfy and a
# maintainer script that says who ran it.

. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive
umask 0022

apt_update_once

ROOT=/build/hello-tips
rm -rf "$ROOT"
mkdir -p "$ROOT/DEBIAN" "$ROOT/usr/bin"

# Architecture: all, so every version and listing this page prints reads the same on a CI runner
# as it does here. See test/architecture.test.ts.
#
# Depends: cowsay is the whole of the `dpkg -i` half of the page. dpkg unpacks a package whose
# dependencies are missing and then refuses to configure it, and that failure is what the page
# documents. Satisfy the dependency and `apt install` and `dpkg -i` behave identically, leaving
# the page comparing two commands that do the same thing.
cat > "$ROOT/DEBIAN/control" <<'CTL'
Package: hello-tips
Version: 1.0-1
Section: utils
Priority: optional
Architecture: all
Depends: cowsay
Maintainer: Example Vendor <packages@example.com>
Description: Demonstration package for installing a .deb by hand
 Prints a greeting through cowsay, so that it has a dependency
 the machine does not already satisfy.
CTL

# A postinst that prints who is running it. A .deb can run arbitrary code as root, and a page
# can only assert that unless something in the transcript demonstrates it. This is that thing:
# it puts `root` in the output of an ordinary install.
cat > "$ROOT/DEBIAN/postinst" <<'PI'
#!/bin/sh
set -e
echo "hello-tips: postinst running as $(id -un)"
PI
chmod 755 "$ROOT/DEBIAN/postinst"

printf '#!/bin/sh\nexec /usr/games/cowsay "Hello from a .deb"\n' > "$ROOT/usr/bin/hello-tips"
chmod 755 "$ROOT/usr/bin/hello-tips"

dpkg-deb --build --root-owner-group "$ROOT" ./hello-tips_1.0-1_all.deb >/dev/null

# Both packages absent before every example. Several examples install one or both, and the
# restore only clears the working directory, so without this an example would run against
# whatever the one above it left behind. `dpkg -i` succeeds quietly once cowsay is present,
# which is the opposite of what this page documents.
if dpkg -s hello-tips >/dev/null 2>&1; then
  dpkg --purge --force-depends hello-tips >/dev/null 2>&1
fi
if dpkg -s cowsay >/dev/null 2>&1; then
  apt-get purge -y cowsay >/dev/null 2>&1
fi
