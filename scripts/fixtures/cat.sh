#!/usr/bin/env bash
# Fixtures for content/commands/cat/examples.yaml. Must match its `fixtures:` block.
#
# The page's subject is what `cat` puts on screen, so the sample files exist to carry the
# things that are invisible until `cat -A` shows them: runs of blank lines, a tab, and
# carriage returns.

. /tmp/fixtures-common.sh

# The current log is the shared one, so a reader arriving from tail or grep meets the same
# ten requests rather than a new file that happens to look similar.
mk_access_log

# The rotated half of the same log. Its timestamps are all earlier than access.log's, which
# is what makes `cat access.log.1 access.log` read in order and `cat access.log access.log.1`
# read out of it.
cat > access.log.1 <<'EOF'
203.0.113.5 - - [12/Aug/2026:23:58:11] "GET /index.html HTTP/1.1" 200 512
198.51.100.7 - - [12/Aug/2026:23:59:02] "GET /about.html HTTP/1.1" 200 1044
192.0.2.44 - - [13/Aug/2026:00:01:40] "GET /index.html HTTP/1.1" 200 512
203.0.113.5 - - [13/Aug/2026:00:04:19] "POST /login HTTP/1.1" 401 0
EOF

# Runs of one and two blank lines, which is what `-s` collapses and what makes `-n` and `-b`
# disagree. No tabs and no trailing spaces: this file is shown to the reader as plain `cat`
# output, so anything invisible in it would be a fixture the page cannot display honestly.
cat > notes.txt <<'EOF'
Release checklist

- bump the version


- run the full replay
- tag and push


Nothing is done yet.
EOF

# Written with CRLF line endings and one tab, the state a file arrives in from an editor on
# Windows. Every `-A`, `-E`, `-T` and `-v` example on the page reads this file, and the page
# claims the script fails to run, so the carriage returns have to be real rather than typed
# as the two characters `^M`.
printf '#!/bin/sh\r\nset -e\r\nif [ -d dist ]; then\r\n\trsync -a dist/ web@deb1:/srv/www/\r\nfi\r\n' > deploy.sh
chmod 755 deploy.sh
