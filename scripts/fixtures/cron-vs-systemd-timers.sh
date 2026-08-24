#!/usr/bin/env bash
# Fixtures for content/compare/cron-vs-systemd-timers.md.
#
# The page compares two schedulers, so the sandbox has to be running the one that needs PID 1.
# verify: --systemd
#
# Both halves are set up to do the same job, because the page's first claim is that the same
# work looks different rather than that it is different work.
#
# One claim on this page is deliberately not a fenced block: that cron hands a *user* crontab
# job PATH=/usr/bin:/bin while a systemd service gets systemd's own. Verified by hand in this
# sandbox on 2026-08-20 -- a crontab entry running `printenv PATH` printed exactly
# `/usr/bin:/bin`. It is prose rather than a block because cron's finest granularity is one
# minute, and a replay that waits a minute for one line would cost more than the whole rest of
# the site's replay put together.
#
# Note the file it writes is under /tmp rather than the working directory: the harness wipes
# the workdir between examples, and this has to survive being set up once.

# A settled starting point: `crontab -l` is the first thing this page prints, and the blocks
# below it edit the crontab, so the one written here has to replace whatever they left rather
# than be appended to it.
crontab -r 2>/dev/null

crontab - <<'CRON'
30 3 * * 1 /usr/local/bin/weekly-report
CRON

cat > /etc/systemd/system/report.service <<'UNIT'
[Unit]
Description=Weekly report

[Service]
Type=oneshot
ExecStart=/bin/echo report generated
UNIT

cat > /etc/systemd/system/report.timer <<'UNIT'
[Unit]
Description=Weekly report

[Timer]
OnCalendar=Mon *-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl start report.timer >/dev/null 2>&1
