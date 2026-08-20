---
title: "cron vs systemd timers"
description: "Debian ships both and uses both. What differs is where the output goes, what happens to a missed run, and whether you can test the schedule."
category: compare
tags: [cron, systemd, sysadmin, debian]
updated: 2026-08-20
related: [crontab, systemctl, journalctl, systemd-services]
---

Every Debian system has `cron` running and `systemd` managing timers, and Debian uses both for
its own maintenance. The usual advice is that timers are the modern way, which is true and not
much help: cron is not deprecated, is not going anywhere, and is still the right answer for
plenty of jobs.

What actually separates them is smaller and more practical than "old versus new".

## The same job, two shapes

A weekly report at 03:30 on Monday, in cron:

```bash
crontab -l
```
```
30 3 * * 1 /usr/local/bin/weekly-report
```

The same thing as a timer is two units — one describing *when*, one describing *what*:

```bash
systemctl cat report.timer report.service
```
```
# /etc/systemd/system/report.timer
[Unit]
Description=Weekly report

[Timer]
OnCalendar=Mon *-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target

# /etc/systemd/system/report.service
[Unit]
Description=Weekly report

[Service]
Type=oneshot
ExecStart=/bin/echo report generated
```

One line against fifteen. If that were the whole story, cron would win every time — and for a
job this simple it broadly does. The three differences below are what you are buying with the
extra ceremony.

## Where the output goes

A cron job's output is emailed to you, and on a machine with no mail transport configured —
which is most machines — it goes nowhere. This is the single most common way a broken cron job
stays broken quietly.

A timer's job is a service, so its output is captured in the journal against the unit that
produced it:

<!-- verify: shape the timestamps and the PID are specific to the run -->
```bash
systemctl start report.service && journalctl -u report.service --no-pager -n 4
```
```
Aug 20 07:03:41 deb1 systemd[1]: Starting report.service - Weekly report...
Aug 20 07:03:41 deb1 echo[331]: report generated
Aug 20 07:03:41 deb1 systemd[1]: report.service: Deactivated successfully.
Aug 20 07:03:41 deb1 systemd[1]: Finished report.service - Weekly report.
```

`journalctl -u report.service` from then on is the job's whole history, without anyone having
had to arrange logging. See [journalctl](/commands/journalctl/) for querying it.

## What happens to a missed run

If the machine is off at 03:30 on Monday, cron simply does not run the job. `Persistent=true`
on a timer records when it last fired and runs it on the next boot instead.

Debian softens this for cron with `anacron`, which is why `/etc/cron.daily` still runs on a
laptop that is asleep overnight — but that applies to the `/etc/cron.*` directories, not to
your own `crontab -e` entries, which get no such treatment.

## Whether you can check the schedule before it fires

Cron's five fields have no dry run. You write them, wait, and find out. A calendar expression
can be asked directly:

<!-- verify: shape the next elapse and the time remaining move with the clock -->
```bash
systemd-analyze calendar 'Mon *-*-* 03:00:00'
```
```
Normalized form: Mon *-*-* 03:00:00
    Next elapse: Mon 2026-08-24 03:00:00 UTC
       From now: 3 days left
```

Being able to confirm what an expression means before trusting it to fire at 3am is worth more
than it sounds.

## One trap that catches everyone

A user crontab job runs with `PATH=/usr/bin:/bin` — verified on a Debian trixie system, not
quoted from memory. A systemd service gets systemd's own default, which includes
`/usr/local/sbin` and `/usr/local/bin`. A script that works at your prompt and fails under cron
is usually this, and neither tool warns you.

## What Debian itself does

Both, and it is worth seeing which jobs it trusts to which:

```bash
systemctl list-unit-files '*.timer' --no-pager
```
```
UNIT FILE                    STATE    PRESET
apt-daily-upgrade.timer      enabled  enabled
apt-daily.timer              enabled  enabled
dpkg-db-backup.timer         enabled  enabled
fstrim.timer                 enabled  enabled
man-db.timer                 enabled  enabled
report.timer                 disabled enabled
systemd-tmpfiles-clean.timer static   -

7 unit files listed.
```

Package updates, the dpkg database backup, `fstrim` and the man page index are all timers.
`report.timer` is the one this page just created. Meanwhile `/etc/cron.daily` is still there and
still runs. Debian did not migrate; it added.

## The honest verdict

Use **cron** for a personal, simple, recurring job on a machine that stays on: a backup script,
a sync, a cleanup. One line in `crontab -e` and you are done, and [crontab](/commands/crontab/)
covers the syntax.

Use **a timer** when the job matters to someone other than you — when you need its output kept,
when a missed run has to catch up, when it should wait for the network, or when it needs a
memory or CPU limit. Those are all things a unit file expresses and cron has no vocabulary for.

The tipping point is not complexity of the schedule. It is whether you will need to answer the
question "did it run, and what did it say?" three weeks from now.
