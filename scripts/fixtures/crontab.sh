#!/usr/bin/env bash
# Fixtures for content/commands/crontab/examples.yaml. Must match its `fixtures:` block.
#
# Run this page as root (no --user): most of it is about root's own crontab, `-u`, and
# /var/spool/cron/crontabs, none of which an unprivileged user can reach.
#
# Unlike every other page, the state this one mutates does not live in the working
# directory: `crontab` writes to /var/spool/cron/crontabs. Restoring the working
# directory therefore restores nothing, so this script explicitly clears both crontabs
# before every example.

service cron start >/dev/null 2>&1

crontab -r 2>/dev/null
crontab -u user -r 2>/dev/null

cat > mycron.txt <<'EOF'
# m h  dom mon dow   command
0 3 * * * /usr/bin/find /var/log -name '*.log' -mtime +7 -delete
*/15 * * * * /home/user/bin/check-disk.sh
0 9 * * 1-5 /home/user/bin/send-report.sh
@reboot /home/user/bin/startup.sh
@daily /home/user/bin/cleanup.sh
EOF

cat > usercron.txt <<'EOF'
0 2 * * * /home/user/bin/backup.sh
EOF
