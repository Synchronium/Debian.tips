#!/usr/bin/env bash
# Fixtures for content/troubleshooting/script-works-in-shell-but-not-cron.md.
#
# Replayed as the unprivileged `user`. cron sets `HOME` and `LOGNAME` from the account that owns
# the crontab and the page prints both, so as root every captured line would name root instead,
# and the crontab the page installs would be a different one.
# verify: --user

CAPTURE_DIR=/var/tmp/tips-cron
CAPTURED=$CAPTURE_DIR/.captured

# `user` has passwordless sudo in the sandbox image, which is what lets an unprivileged setup
# script install commands into /usr/local/bin and start cron.
sudo install -d -m 755 -o user -g user "$CAPTURE_DIR"

# The job, and the command inside it that cron cannot find. Both live in /usr/local/bin, which
# is on an interactive PATH and is not on the one cron supplies: that difference is the page.
# Rewritten every run, because the working directory is all the harness restores.
printf '#!/bin/sh\necho "report written"\n' | sudo tee /usr/local/bin/tips-report >/dev/null
printf '#!/bin/sh\ntips-report\n' | sudo tee /usr/local/bin/tips-nightly >/dev/null

# What cron runs during the capture below, writing one file per question the page asks. The
# marker is written last, so a wait on it cannot see a half-finished capture.
sudo tee /usr/local/bin/tips-cron-capture >/dev/null <<'SH'
#!/bin/sh
d=/var/tmp/tips-cron
env > "$d/env.txt"
/usr/local/bin/tips-nightly > "$d/run.log" 2>&1
echo "status: $?" >> "$d/run.log"
: > "$d/.captured"
SH
sudo chmod 755 /usr/local/bin/tips-report /usr/local/bin/tips-nightly /usr/local/bin/tips-cron-capture

sudo service cron start >/dev/null 2>&1

# Everything the page quotes from cron was produced by cron, once per container. A job can only
# start on a minute boundary, so this waits out the rest of the current minute; running it before
# every example instead would spend that on each of them.
if [ ! -e "$CAPTURED" ]; then
  rm -f "$CAPTURE_DIR/env.txt" "$CAPTURE_DIR/run.log"
  printf '* * * * * /usr/local/bin/tips-cron-capture\n' | crontab -
  for _ in $(seq 1 90); do
    [ -e "$CAPTURED" ] && break
    sleep 1
  done
  crontab -r 2>/dev/null
fi

# A capture that never happened would leave every block on the page reading an empty file, which
# looks like drift rather than like cron never having started.
if [ ! -s "$CAPTURE_DIR/env.txt" ]; then
  echo "script-works-in-shell-but-not-cron: cron never ran the capture job" >&2
  exit 1
fi

# The crontab the page reads back. Scheduled for an hour that will not arrive during a replay,
# so cron cannot append to the captured files behind an example that is reading them.
printf '30 3 * * * /usr/local/bin/tips-nightly\n' | crontab -
