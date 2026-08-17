---
title: "systemctl"
tagline: "Control systemd services, and what starts at boot"
description: "Tested systemctl examples: starting and stopping services, enabling them at boot, reading unit state, drop-in overrides, and diagnosing failures."
category: commands
tags: [systemd, sysadmin, processes]
updated: 2026-08-17
tier: flagship
related: [journalctl, systemd-services, crontab, kill-whatever-is-using-a-port, exit-codes-and-error-handling]
---

`systemctl` is how you talk to systemd, which has been Debian's init system since jessie. It
starts and stops services, decides what comes back after a reboot, and reports why something
didn't. Almost every "is it running?" question on a Debian box is answered here.

## Enabled and active are different things

This is the distinction that catches people, and most confusion about systemd comes from
conflating the two. Every unit has two independent states:

- **active** — is it running *right now*?
- **enabled** — will it start *at the next boot*?

Neither implies the other. A service you started by hand is active but not enabled, and vanishes
on reboot. A service you enabled but never started is enabled but not active, and does nothing
until you reboot. Stopping a service does not disable it, which is why a "fixed" server so often
breaks again the next morning.

```bash
systemctl is-active deploy-agent    # active | inactive | failed
systemctl is-enabled deploy-agent   # enabled | disabled | static | masked
```

`--now` bridges the two: `enable --now` enables *and* starts, `disable --now` disables *and*
stops. When you mean both, say both.

## Reading a status block

`systemctl status` is the first thing to run and the densest thing to read:

```
● deploy-agent.service - Deploy agent
     Loaded: loaded (/etc/systemd/system/deploy-agent.service; disabled; preset: enabled)
     Active: active (running) since Mon 2026-08-17 10:32:36 UTC; 9ms ago
   Main PID: 1329 (deploy-agent)
     CGroup: /system.slice/deploy-agent.service
```

The leading glyph is a quick health check: `●` for active or failed, `○` for stopped. `Loaded:`
gives the unit file's path and whether it is enabled — that one line answers both state questions
at once. `Active:` gives the current state and how long it has held it. Below that come the main
PID, resource use, the process tree, and the last few journal lines for the unit —
[`journalctl -u`](/commands/journalctl/) is how you read the rest of them.

Because the timestamps, PIDs and memory figures differ on every machine and every run, the
examples on this page show the parts that don't, and use `is-active`, `is-enabled` and
`systemctl show` where an exact answer matters. Those are also the forms to use in a script:
they print one word and set a meaningful exit code.

## systemd caches unit files

systemd parses a unit file once and works from its own copy. Editing the file on disk changes
nothing until you tell systemd to re-read it:

```bash
sudo systemctl daemon-reload
```

Forget it and you get the most confusing symptom in systemd: a config file that plainly says one
thing while the service plainly does another. `systemctl status` warns about it, and the warning
is worth reading rather than scrolling past. A unit that isn't loaded yet is read fresh when it is
first used, which is why the mistake sometimes appears to work.

`daemon-reload` re-reads unit files. It does not restart anything, so a running service keeps its
old settings until you restart it too.

## Where unit files live

Three locations, in increasing order of authority:

- `/usr/lib/systemd/system/` — units shipped by [Debian packages](/debian/apt-essentials/). Don't
  edit these; an upgrade overwrites them.
- `/etc/systemd/system/` — units you write, and overrides. Wins over the package copy.
- `/etc/systemd/system/<unit>.d/*.conf` — drop-ins, which change individual settings while
  leaving the rest of the package's unit intact. Usually what you want.

`systemctl cat` shows the file and every drop-in applying to it, in the order systemd reads them,
which beats guessing which of the three is winning.
[Managing services with systemd](/debian/systemd-services/) covers what Debian's packaging does
with these directories, and why a drop-in survives an upgrade that an edited package unit does
not.

## Root, and reading versus writing

Querying state needs no privileges: `status`, `is-active`, `list-units` and `cat` all work as any
user. Changing it needs root, so `start`, `stop`, `enable`, `mask` and `daemon-reload` want
`sudo`. The examples below show `sudo` where it is genuinely required.

> [!NOTE]
> Examples that alter a service use `deploy-agent`, a unit that exists only for this page. The
> commands are identical for a real service — substitute `ssh`, `nginx` or whatever you are
> working on. A unit's `.service` suffix is optional on the command line: `systemctl status ssh`
> and `systemctl status ssh.service` are the same request.
