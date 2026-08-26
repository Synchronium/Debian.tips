#!/usr/bin/env bash
# Fixtures for content/commands/apt-file/.
#
# The page's sample data is Debian's own Contents index, so most of what this does is put the
# sandbox into the state a reader reaches after installing the package and updating once.
#
# Every step is guarded. This script runs again before each documented output, and a 50 MB
# index fetch on each would dominate the run.

export DEBIAN_FRONTEND=noninteractive
umask 0022

# apt-file is not in Debian's base install, which is the first thing the page says. Installing
# it drops /etc/apt/apt.conf.d/50apt-file.conf, and that fragment is what adds the Contents
# indices to what `apt update` fetches. Without the package there is no index to search, and
# without the index every search on this page prints "the cache is empty" instead of an answer.
if ! dpkg -s apt-file >/dev/null 2>&1; then
  apt-get update >/dev/null 2>&1
  apt-get install -y --no-install-recommends apt-file >/dev/null 2>&1
fi

# The Contents indices themselves. `apt-file update` is `apt-get update` restricted to them, so
# either command fetches the same files; this uses apt-file's so a container that somehow has
# the package lists but not the Contents still ends up with both.
if ! ls /var/lib/apt/lists/*Contents-* >/dev/null 2>&1; then
  apt-file update >/dev/null 2>&1
fi

# cowsay absent. Half this page is about answering "which package ships this file" for a file
# the machine does not have, and `dpkg -S /usr/games/cowsay` has to fail for the comparison
# against apt-file to mean anything.
if dpkg -s cowsay >/dev/null 2>&1; then
  apt-get purge -y cowsay >/dev/null 2>&1
fi

# The batch of paths the -f examples read. Three packages on three different sides of the
# archive: one installed by nothing here, one a development header, one a game.
cat > wanted.txt <<'EOF'
/usr/bin/nslookup
/usr/include/zlib.h
/usr/games/cowsay
EOF

# A downloaded .deb for the --from-deb example, fetched once and copied in on each restore.
# Downloading it inside the example instead put that example within a second of the harness's
# five-second cap, and an example that only just fits reports a true page as a lying one the
# first time it runs somewhere slower.
DEBS=/srv/debs
if ! ls $DEBS/cowsay_*.deb >/dev/null 2>&1; then
  mkdir -p $DEBS
  ( cd $DEBS && apt-get download cowsay >/dev/null 2>&1 )
fi
cp $DEBS/cowsay_*.deb .
