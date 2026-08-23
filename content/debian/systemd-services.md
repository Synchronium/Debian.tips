---
title: "Managing services with systemd"
tagline: "What Debian's packaging does to a service behind your back"
description: "How Debian ships, enables and starts systemd services, where unit files live, and how to override a packaged unit without ever editing it."
category: debian
tags: [systemd, debian, sysadmin]
updated: 2026-08-17
related: [systemctl, journalctl, apt-essentials, crontab]
---

systemd has been Debian's init system since jessie, and it is what starts almost everything on
a Debian machine, in what order, and what happens when one of those things dies. Most of the
day-to-day work is four subcommands of [`systemctl`](/commands/systemctl/), which that page
covers. This one is about the part that is specific to Debian: what the packaging system does to
services behind your back, where Debian puts the files, and which of them you are allowed to
edit.

## Installing a package usually starts the service

This is the first thing that surprises anyone arriving from Red Hat or its derivatives. Debian
policy says a package that ships a service should start it on install, and enable it at boot,
without being asked. Install the SSH server and it is already running:

```bash
sudo apt install openssh-server
```

Then, without doing anything else:

```bash
systemctl is-enabled ssh
systemctl is-active ssh
```
```
enabled
active
```

On Fedora or RHEL the same install leaves you with a stopped, disabled service and a second step
to perform. Neither convention is wrong, but assuming the wrong one is how a machine ends up
running a service nobody meant to expose. After installing anything that listens on a port, it is
worth checking rather than assuming, in whichever direction your instinct runs.

The flip side is that `apt remove` stops the service on its way out, and that an upgrade touching
a service package will usually restart it. A long-running job on a machine that applies security
updates automatically can be interrupted by exactly that, which is a good reason to know what
[`apt`](/debian/apt-essentials/) is going to do before it does it.

> [!NOTE]
> Inside a Docker container or a chroot this does not happen, and the reason is a Debian
> mechanism rather than a container one. If `/usr/sbin/policy-rc.d` exists and exits `101`,
> Debian's maintainer scripts skip starting services. The official `debian` images ship one,
> which is why the same `apt install` there leaves you with `enabled` and `inactive`: the file
> blocks the *start*, not the *enable*.

## Enabled and active are different questions

`enabled` means "start at boot". `active` means "running right now". Neither implies the other,
which is why the container case above can honestly report `enabled` and `inactive` at the same
time. A service you started by hand disappears at the next reboot; a service you enabled but
never started does nothing until then. `systemctl` has
[the full treatment of both states](/commands/systemctl/), including `--now`, which does the two
things at once.

## Where Debian keeps unit files

Two directories matter, and the difference between them is ownership rather than precedence
alone:

- **`/usr/lib/systemd/system/`** belongs to the package manager. Every unit installed by a `.deb`
  lands here, and the next upgrade of that package overwrites whatever is in it.
- **`/etc/systemd/system/`** belongs to you. Units you write, and overrides of packaged ones, go
  here, and `apt` will not touch them.

You may still see `/lib/systemd/system` in older documentation. On a current Debian system `/lib`
is a symlink to `/usr/lib`, so both paths name the same directory, and systemd reports the `/usr`
form:

```bash
systemctl show -p FragmentPath ssh
```
```
FragmentPath=/usr/lib/systemd/system/ssh.service
```

`/etc/init.d/` also still exists, and on a stock install still holds scripts for `cron`, `ssh`,
`dbus` and a handful of others. They are compatibility shims: systemd generates a unit from an
init script when no native unit exists, and Debian ships both for packages whose users may still
be running sysvinit. On a systemd machine the native unit wins, so these are rarely the file you
want to read.

## Override a packaged unit, do not edit it

Editing a file under `/usr/lib/systemd/system/` works exactly until the next upgrade of that
package silently reverts it. The supported approach is a **drop-in**: a fragment under
`/etc/systemd/system/<unit>.d/` holding only the settings you want to change, with the package's
unit left intact underneath.

`systemctl edit` creates one, opening `$EDITOR` on the right path so you do not have to know it:

<!-- verify: skip opens $EDITOR on a tty, which a batch run has no way to drive -->
```bash
sudo systemctl edit ssh
```
```
Successfully installed edited file '/etc/systemd/system/ssh.service.d/override.conf'.
```

Given a fragment setting `Restart=always` and `RestartSec=5`, `systemctl cat` then shows the
packaged unit and every drop-in applying to it, each labelled with the file it came from, in the
order systemd reads them. The drop-in comes last, which is why it wins:

```bash
systemctl cat ssh | tail -5
```
```

# /etc/systemd/system/ssh.service.d/override.conf
[Service]
Restart=always
RestartSec=5
```

To confirm what is in force rather than what the files say, ask systemd for the resolved
value:

```bash
systemctl show -p Restart -p RestartUSec ssh
```
```
Restart=always
RestartUSec=5s
```

Two things bite here. A drop-in adds to the packaged unit rather than replacing it, so a
directive that takes a list (`ExecStart` is the usual victim) needs an empty assignment first,
`ExecStart=`, to clear the packaged value before setting your own. And systemd works from its own
parsed copy of every unit, so a change on disk does nothing until `sudo systemctl daemon-reload`.
`systemctl edit` runs that for you; editing the file by hand does not.

## Debian already runs timers

A **timer unit** does what a cron entry does, and Debian uses several out of the box. On a stock
install:

```bash
systemctl list-unit-files --type=timer --state=enabled
```
```
UNIT FILE               STATE   PRESET
apt-daily-upgrade.timer enabled enabled
apt-daily.timer         enabled enabled
dpkg-db-backup.timer    enabled enabled
fstrim.timer            enabled enabled
man-db.timer            enabled enabled

5 unit files listed.
```

That is Debian refreshing your package lists, backing up the dpkg database, trimming SSDs and
rebuilding the man page index, none of it in a crontab. `systemctl list-timers` shows the same
set with the next and last run times filled in, which is the view you want when asking why
something ran at four in the morning.

Debian did not migrate away from cron, though. `/etc/cron.daily` is still there and still runs.
[cron vs systemd timers](/compare/cron-vs-systemd-timers/) is the comparison, including which of
the two a given job wants.

For your own jobs, [`crontab`](/commands/crontab/) is still fewer keystrokes, and a timer costs
two files instead of one line. What a timer buys is that its output goes to the journal with a
recorded exit status, rather than being mailed to a user who does not exist. That trade is worth
it for anything whose failure you would want to notice.

## Remove, purge, and the choice Debian remembers

Debian records whether *you* enabled or disabled a service, separately from what the package
wanted, in `/var/lib/systemd/deb-systemd-helper-enabled/`. That state survives a `remove` and is
deleted by a `purge`, which produces a distinction worth knowing:

```bash
sudo systemctl disable ssh
sudo apt remove openssh-server && sudo apt install openssh-server
systemctl is-enabled ssh        # disabled, your choice was remembered
```

```bash
sudo apt purge openssh-server && sudo apt install openssh-server
systemctl is-enabled ssh        # enabled, back to the package default
```

This is the same `remove` versus `purge` split that governs configuration files in
[APT essentials](/debian/apt-essentials/), applied to service state. If a reinstall has
mysteriously re-enabled something you turned off, a purge somewhere in the history is the usual
explanation.

## Common misconceptions

- **"`systemctl stop` will keep it off."** It stops the service now and changes nothing about
  boot. The service returns at the next reboot unless you also `disable` it. This is the single
  most common cause of a "fixed" server breaking again overnight.
- **"`daemon-reload` restarts my services."** It re-reads unit files and nothing else. A running
  service keeps the settings it started with until you restart it too.
- **"The service failed, so the logs are gone."** They are in the journal, which is where a
  service's stdout and stderr go. `journalctl -u <unit>` has them, including for a unit that
  failed at boot three days ago. See [`journalctl`](/commands/journalctl/).
- **"Editing the file in `/usr/lib/systemd/system/` is fine, I will remember."** The upgrade that
  reverts it will arrive months later, and the symptom is a config file that says one thing
  while the service does another.
- **"`disabled` means it cannot start."** A disabled service can still be started by hand, or
  pulled in as a dependency of something else. `masked` is the state that genuinely prevents it,
  and `systemctl is-enabled` reports that separately.

## Go deeper

- [`systemctl`](/commands/systemctl/): the tested command reference for starting, enabling,
  drop-in overrides, reading a status block, and diagnosing a failed unit
- [`journalctl`](/commands/journalctl/): filtering the journal by unit, priority and time, which
  is where every question about a failed service ends up
- [APT essentials](/debian/apt-essentials/): the package layer underneath all of this, including
  what `remove` and `purge` each leave behind
- [`crontab`](/commands/crontab/): the other scheduler, and the one to use when a timer is
  more machinery than the job deserves
