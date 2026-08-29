#!/usr/bin/env bash
# Fixtures for content/recipes/find-permission-denied.md.
#
# Replayed as the unprivileged `user`, because root ignores the permission bits this page is
# about: as root every example finds everything, prints no error, and the page is left claiming
# a problem the run could not reproduce.
# verify: --user

# The restore deletes this tree and runs this script again before every example, and `find
# -delete` cannot descend into a directory with no permissions. The mode goes back first, or the
# second example onwards would run against a half-removed tree.
[ -d srv/cache ] && chmod 755 srv/cache
rm -rf srv

# Two matching files in two readable directories, so the page's `| sort` is doing something: a
# single match would hide that `find` walks a tree in directory order rather than alphabetically.
mkdir -p srv/www srv/cache srv/logs
printf 'server_name deb1;\n' > srv/www/site.conf
printf '<!doctype html>\n' > srv/www/index.html
printf 'weekly\n' > srv/logs/rotate.conf
printf 'GET / 200\n' > srv/logs/app.log

# The unreadable directory, holding a match nobody can see. Mode 000 on a directory this account
# owns stands in for the root-owned directories a real `find /` walks into; the kernel checks the
# owner's bits the same way it checks anyone else's, and only root is exempt.
printf 'cached\n' > srv/cache/session.conf
chmod 000 srv/cache
