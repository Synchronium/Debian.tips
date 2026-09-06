---
title: "Where things live on a Debian system"
description: "Why configuration is in /etc, why /usr belongs to apt, what /var accumulates, and which two directories the package manager will never touch."
category: concepts
tags: [files, debian, beginner]
updated: 2026-09-06
related: [dpkg, apt, which-package-provides-a-file, file-permissions-explained]
---

Every directory at the root of a Debian system has an owner, and it is not always you. Knowing
which of them are yours to write in answers the two questions people actually arrive with: where
do I put this script, and why is the configuration for one program in three different places.

Three rules cover nearly all of it.

**`/usr` belongs to the package manager.** Everything in it arrived in a `.deb` and will be
replaced by the next upgrade.

**`/etc` is yours.** Packages put their defaults there and then leave your edits alone.

**`/var` is what the machine accumulates while it runs.** Logs, caches, queues, databases.

## The layout is smaller than it looks

`/bin`, `/sbin` and `/lib` are not directories:

```bash
stat -c '%N' /bin /sbin /lib
```
```
'/bin' -> 'usr/bin'
'/sbin' -> 'usr/sbin'
'/lib' -> 'usr/lib'
```

Debian merged them into `/usr` over several releases, finishing in bookworm. The old paths remain
as symlinks and will keep working, so `#!/bin/sh` is still correct and every script that uses it
still runs. There is one directory of programs, one of libraries, and three names apiece.

Historically the split meant something: `/bin` held what was needed to bring the system up far
enough to mount `/usr`, which might be on another disk or another machine. An initramfs does that
job now. The distinction had been decorative for years before it was removed.

## /usr belongs to the package manager

Ask what a package installed and every path is under `/usr`, except its configuration:

```bash
dpkg -L cron | grep -E '/(cron|crontab)$' | sort
```
```
/etc/default/cron
/etc/init.d/cron
/etc/pam.d/cron
/usr/bin/crontab
/usr/sbin/cron
/usr/share/bug/cron
/usr/share/doc/cron
```

`/usr/bin` for programs anyone runs, `/usr/sbin` for ones that only make sense as root,
`/usr/share` for anything that does not depend on the machine's architecture: documentation, icons,
default templates, translations. `/usr/lib` holds the shared libraries and the helper programs a
package runs but you do not.

Asked in reverse, it explains a file you did not expect to find:

```bash
dpkg -S /usr/games/cowsay
```
```
cowsay: /usr/games/cowsay
```

[Which package provides a file](/debian/which-package-provides-a-file/) covers that lookup
properly, including the case where the file is not installed yet.

## /etc is yours, and Debian records that you changed it

A package's files in `/etc` are declared as *conffiles*, which is a promise about upgrades: your
version is kept, and you are asked before anything replaces it.

```bash
dpkg-query -W -f='${Conffiles}' cron | awk 'NF {print $1}'
```
```
/etc/default/cron
/etc/init.d/cron
/etc/pam.d/cron
/etc/supercat/spcrc-crontab
/etc/supercat/spcrc-crontab-light
```

Each one was shipped with a checksum, so the package manager can tell an edited file from an
untouched one:

```bash
echo '# local change' >> /etc/default/cron
dpkg -V cron
```
```
??5?????? c /etc/default/cron
```

`c` marks it a conffile and `5` says the checksum no longer matches. `dpkg -V` with no package
name audits every installed package the same way. On a machine somebody else has been
administering, that is the fastest thing to run first.

This is why configuration is spread across several files rather than one. `/etc/default/cron`
holds Debian's own settings for the service, `/etc/init.d/cron` starts it, `/etc/pam.d/cron`
decides how it authenticates, and a `*.d` directory usually sits beside the main file so a package
or an administrator can drop in a fragment without editing anything shared. `/etc/apt/sources.list.d/`
and `/etc/sudoers.d/` are the two you will meet first.

## /var is what accumulates

Nothing in `/var` arrives with a package in any useful sense: it is what the machine writes while
it runs. It is also the directory that fills up.

- `/var/log` holds logs, whether written by a program directly or by the journal under
  `/var/log/journal`.
- `/var/cache` holds things that can be regenerated. `/var/cache/apt/archives` is every `.deb`
  apt has downloaded; `apt clean` empties it.
- `/var/lib` holds state a program cannot regenerate. `/var/lib/dpkg/status` is the database of
  what is installed on this system. Lose it and no package manager knows what the machine has.
- `/var/tmp` is for temporary files that should survive a reboot, where `/tmp` is for ones that
  should not.

The distinction between `cache` and `lib` is worth keeping straight when disk space runs out.
Deleting `/var/cache` costs you a download; deleting `/var/lib` costs you the system.

## /usr/local and /opt are the two apt will never touch

Put something in `/usr/bin` yourself and the next upgrade of the package that owns that path will
overwrite it. `/usr/local` exists so that cannot happen. It mirrors the layout of `/usr` beneath it
(`/usr/local/bin`, `/usr/local/share`) and no Debian package writes there:

```bash
dpkg -S /usr/local/bin/deploy
```
```
dpkg-query: no path found matching pattern /usr/local/bin/deploy
```

That file exists and is executable. `dpkg` reports no owner because nothing in the package database
claims it. That absence is the guarantee: `/usr/local` sits outside what an upgrade considers.

`/opt` differs in shape rather than in ownership. `/usr/local` is a merged tree, so a program's
binary, its manual page and its data go to three separate directories. `/opt` gives a program one
directory of its own, `/opt/something`, laid out however its vendor likes. Software that ships as a tarball and expects to live in one place belongs there; something
you compiled from source belongs in `/usr/local`, which is where `make install` puts it by default.

`/srv` is the least used of the three. It is for data a machine serves to the outside world:
`/srv/www`, `/srv/ftp`. Debian creates it empty and has no opinion about what goes inside.

## Not everything under / is on a disk

```bash
stat -f -c '%n is %T' /proc /sys
```
```
/proc is proc
/sys is sysfs
```

Neither exists on any disk. `/proc` is the kernel presenting process and system information as
files, and it is where `ps` and `free` get their answers. `/sys` does the same for devices and
drivers. `/run` holds runtime state like PID files and sockets in memory, so it empties on every
boot by never having been written down.

Writing to a file under `/proc` or `/sys` changes a kernel setting until the next reboot. Making
the change permanent means a file in `/etc`.

## Common misconceptions

**"`/usr` stands for Unix System Resources."** That expansion was invented afterwards to fit the
letters. It stood for *user*, because home directories were kept there in the 1970s. They moved to
`/home` when the disk filled up, and the name stayed.

**"I should install my script in `/bin` because that is where commands live."** `/bin` is a symlink
to `/usr/bin`, which apt owns. Use `/usr/local/bin`, which is on `PATH` for exactly this reason, or
`~/bin`, which Debian's default `~/.profile` adds to `PATH` when it exists.

**"`/etc` is where all configuration goes."** System-wide configuration. A program's per-user
settings go under `~/.config`, and the two are read in that order, so your dotfile wins over the
machine's default.

**"`lost+found` is a problem."** Every ext4 filesystem has one at its root. It is where `fsck` puts
fragments it recovers after a bad shutdown, so an empty one is a filesystem working normally.

## Go deeper

The layout is specified rather than conventional. `hier(7)` is the short version and is worth
reading once, though it comes from the `manpages` package and a minimal Debian does not have it:
`apt install manpages`, then `man 7 hier`. The long version is the Filesystem Hierarchy Standard,
and Debian Policy chapter 9 records where Debian departs from it.

[`dpkg`](/commands/dpkg/) is the tool for asking which package owns a path, and
[`apt`](/commands/apt/) for the rest. [File permissions](/concepts/file-permissions-explained/)
covers who may write where, which this page has taken for granted throughout.
