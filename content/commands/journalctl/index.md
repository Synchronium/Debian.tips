---
title: "journalctl"
tagline: "Read and filter the systemd journal"
description: "Tested journalctl examples: filtering by unit, priority and time, following logs live, output formats, and controlling journal disk usage."
category: commands
tags: [systemd, sysadmin, monitoring]
updated: 2026-08-17
tier: standard
related: [systemctl, crontab, grep]
---

`journalctl` reads the log that systemd collects. Anything a service writes to stdout or
stderr goes there, along with the kernel's messages and systemd's own account of what it
started and why it stopped, all with the metadata to filter by unit, priority, time or boot.

The journal is not a text file. It is an indexed binary store, which is why `journalctl`
has flags for questions that would otherwise be `grep` with a date regex, and why
`/var/log/` looks emptier on a systemd machine than you might expect. `grep` still works on
the output, and [`grep`](/commands/grep/) is the right tool once you have narrowed things
down with `-u` and `--since`.

Three flags do most of the work:

```bash
journalctl -u nginx          # one unit
journalctl -p err            # errors and worse
journalctl --since "1 hour ago"
```

They combine, and combining them is the difference between reading a log and searching one.

## Priorities

`-p` takes a syslog level by name or number, and matches that level *and everything more
severe*: `-p warning` includes errors and critical messages too. From most to least severe
they are `emerg`, `alert`, `crit`, `err`, `warning`, `notice`, `info`, `debug`.

## Who can read what

Reading your own user's entries needs no privileges. Reading everything — other users'
services, the kernel, most system units — means being root or a member of the
`systemd-journal` group:

```bash
sudo usermod -aG systemd-journal "$USER"   # log out and back in
```

The examples below are shown as a root shell would run them. Prefix them with `sudo` if you
are not root and not in that group — though note that `sudo` writes its own entry to the
journal, so `sudo journalctl -n 3` shows you the command you just typed.

> [!NOTE]
> Every line the journal prints carries a timestamp, a hostname and a process id, so the
> output here can never be identical to yours. Examples showing those parts are marked, and
> the ones without a timestamp use `-o cat`, which prints the message alone.
