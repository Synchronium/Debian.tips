#!/usr/bin/env bash
# Fixtures for content/commands/tar/examples.yaml — must match its `fixtures:` block.
#
# Every file gets a pinned mtime, because most of this page's output is `tar -tvf`, which
# prints the stored timestamp of each member.
#
# The archives the extract/list/append examples read are built here rather than by an
# earlier example, since fixtures are restored before every example. They are built with
# --sort=name so the member order — and therefore every listing on the page — is fixed;
# tar otherwise stores entries in directory order, which is a hash order here.
#
# Replays as the unprivileged `user`, because `tar -tvf` prints an owner/group column for
# every member. As root the same page scores 32/42, all of them `root/root`.
# verify: --user

mkdir -p site/img site/css restore restore2 backups

printf '<h1>site</h1>\n' > site/index.html          # 14 bytes
seq 1 100000 | head -c 20480 > site/img/logo.png    # 20K of deterministic, realistically
                                                    # compressible bytes standing in for an image
printf 'body { margin: 0; }\n' > site/css/style.css

# A log with the repetition real logs have: the point of the compression comparison is
# that gzip, bzip2 and xz reach visibly different sizes on the same input.
for i in $(seq 1 2000); do
  printf '203.0.113.5 - - [05/Jul/2026:09:12:01 +0000] "GET /index.html HTTP/1.1" 200 1024\n'
done > access.log

printf '#!/bin/sh\ntrue\n' > suid-file              # 14 bytes
chmod 755 suid-file

chmod 644 site/index.html site/img/logo.png site/css/style.css access.log
chmod 755 site site/img site/css restore restore2 backups

# --- timestamps, before anything is archived ---------------------------------------
touch -d "2026-07-05 15:35:00" site/index.html site/img/logo.png site/css/style.css
touch -d "2026-07-05 15:35:00" site/img site/css site
touch -d "2026-07-05 15:35:00" access.log suid-file
# Everything is pinned, including index.html. A live mtime lands in the tar header and
# shifts the compressed size by a byte between runs, which breaks the "stream to stdout
# | wc -c" example. The "-mtime -1" example makes its own recent change instead.

# --- prebuilt archives the later sections read -------------------------------------
tar --sort=name -czf site-backup.tar.gz site/
tar --sort=name -cf plain.tar site/
touch -d "2026-07-05 15:35:00" site-backup.tar.gz plain.tar

# restore/ already holds an extracted copy, so the -k ("keep existing") example has
# something to refuse to overwrite.
tar -xzf site-backup.tar.gz -C restore/
touch -d "2026-07-05 15:35:00" restore restore2 backups
