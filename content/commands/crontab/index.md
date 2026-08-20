---
title: "crontab"
tagline: "Schedule recurring commands and manage per-user crontabs"
description: "Tested crontab examples: schedule syntax, @reboot/@daily shortcuts, per-user crontabs, and the PATH gotcha that breaks jobs that work fine in your shell."
category: commands
tags: [cron, sysadmin, environment]
updated: 2026-08-17
tier: standard
related: [chmod, find, systemctl, journalctl, exit-codes-and-error-handling]
---

`crontab` edits and lists the scheduled jobs — the **crontab** — belonging to a user. `cron`,
the daemon that actually runs them, wakes up once a minute, checks every installed crontab, and
fires anything due. `crontab -e` opens your crontab in `$EDITOR` (falling back to `vi`), `-l`
lists it without opening an editor, and `-r` deletes it outright, with no confirmation and no
undo.

Each line is five time fields followed by the command to run:

```
*  *  *  *  *  command
│  │  │  │  │
│  │  │  │  └── day of week (0–6, Sunday=0)
│  │  │  └───── month (1–12)
│  │  └──────── day of month (1–31)
│  └─────────── hour (0–23)
└────────────── minute (0–59)
```

A bare `*` means "every value." Narrow it with a step (`*/15`), a range (`9-17`), a list
(`1,15,30`), or combinations of those. `@reboot`, `@daily`, `@hourly`, `@weekly`, `@monthly`, and
`@yearly` replace the five fields with a shorthand for the obvious schedule.

The most common failure mode isn't syntax — it's environment. A job that works perfectly when
you type it yourself can fail silently under cron, because cron runs commands with a minimal
environment: no `.bashrc`, no interactive `$PATH`, none of the aliases or functions your shell
normally has. Always use full paths to scripts and binaries inside a crontab, and set `PATH`
explicitly at the top of the crontab if you rely on anything outside `/usr/bin` and `/bin`.

By default `crontab` edits your own crontab. Root can manage anyone's with `-u <user>`; anyone
else gets `must be privileged to use -u`. System-wide jobs that need to run as a specific user
live in `/etc/crontab` and `/etc/cron.d/` instead, which carry an extra username field the
per-user crontab doesn't have.

## Finding out whether a job ran

Cron mails a job's output to the owning user, and on a machine with no mail transfer agent
installed — which most servers now are — that output is discarded. What survives is cron's own
record of starting the job, which goes to the journal:

```bash
journalctl -u cron --since today    # every job cron started today
```

That tells you a job fired and when, not what it printed, so a job you need to debug should
redirect its own output somewhere you can read it. See
[`journalctl`](/commands/journalctl/) for filtering that log down.

## Or use a systemd timer instead

A timer unit does the same job as a crontab entry, with a real log, a recorded exit status, and
`systemctl list-timers` to show what is scheduled and when it next runs. The cost is two unit
files instead of one line. Cron is still the faster thing to reach for, but for anything whose
failure you would want to notice, [`systemctl`](/commands/systemctl/) covers the alternative, and
[Managing services with systemd](/debian/systemd-services/) shows the timers Debian already runs
on your machine without a crontab anywhere.

[cron vs systemd timers](/compare/cron-vs-systemd-timers/) puts the two side by side on the same
job, if what you want is to decide between them rather than to use one.
