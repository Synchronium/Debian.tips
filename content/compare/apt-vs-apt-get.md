---
title: "apt vs apt-get"
description: "Both are shipped by the same package and do the same job. What differs is who each one is written for, and only one of them is safe in a script."
category: compare
tags: [apt, debian, sysadmin, beginner]
updated: 2026-08-18
related: [apt-essentials, release-channels, third-party-repositories]
---

Every Debian system has both, most tutorials use them interchangeably, and the advice you get
is usually "`apt` is the new one". That is close enough to be unhelpful: they are not different
generations of a tool, they are two interfaces to the same library, aimed at two different
readers.

## They are the same package

Not a rewrite, not a replacement, not a fork:

```bash
dpkg -S "$(command -v apt)" "$(command -v apt-get)"
```
```
apt: /usr/bin/apt
apt: /usr/bin/apt-get
```

Both binaries come out of the `apt` package, built from the same source, linked against the same
`libapt-pkg` — see [`apt`](/commands/apt/) for what that front end can actually do. Anything
`apt` can do, it does by calling the same code `apt-get` calls, and
[`dpkg -S`](/debian/apt-essentials/) is what the query above is doing.

## What actually differs: who each one is for

`apt` is the end-user interface. It defaults to the things that help a person at a terminal —
a progress bar, colour, a summary of what will change — and its command set is a curated subset
of the most-used operations, gathered from `apt-get` and `apt-cache` into one place.

`apt-get` is the stable interface. Its command set is complete rather than curated, its output
is dull on purpose, and its behaviour is held still between releases so that scripts written
years ago keep working.

That is the whole distinction, and apt is unusually direct about it. Piped into anything other
than a terminal, `apt` says so itself:

```bash
apt list --installed 2>&1 | head -4
```
```

WARNING: apt does not have a stable CLI interface. Use with caution in scripts.

Listing...
```

It prints that warning only when it detects that stdout is not a terminal — which is to say,
only when it thinks you might be scripting it. `apt-get` never prints it, because for `apt-get`
that is not a mistake. The manual puts it plainly under *"Script usage and differences from
other APT tools"*:

> The `apt(8)` commandline is designed as an end-user tool and it may change behavior between
> versions. While it tries not to break backward compatibility this is not guaranteed either if
> a change seems beneficial for interactive use.

## The command names differ where the behaviour does

The overlap is large but not total, and the two upgrade commands are where people get caught:

```bash
apt --help | grep -E "^  (upgrade|full-upgrade)"
```
```
  upgrade - upgrade the system by installing/upgrading packages
  full-upgrade - upgrade the system by removing/installing/upgrading packages
```

```bash
apt-get --help | grep -E "^  (upgrade|dist-upgrade)"
```
```
  upgrade - Perform an upgrade
  dist-upgrade - Distribution upgrade, see apt-get(8)
```

`apt full-upgrade` and `apt-get dist-upgrade` are the same operation under two names: upgrade
everything, and remove packages if that is what it takes. The plain `upgrade` in each tool is
where they genuinely differ — `apt upgrade` will install *new* packages when an upgrade needs
them, and `apt-get upgrade` will not, holding those packages back instead. That single
difference is behind most of the "why is apt-get not upgrading this" confusion, and behind
[packages appearing to be kept back](/troubleshooting/packages-kept-back/).

`apt` also folds in commands that were never `apt-get`'s at all: `apt search`, `apt show` and
`apt list` are `apt-cache` operations wearing a friendlier name.

## Which to use

**At a terminal, use `apt`.** It is nicer to read, it needs less typing, and the instability the
warning refers to is a change in output formatting between Debian releases — which matters to a
script and not to you.

**In a script, a cron job, a systemd unit or a Dockerfile, use `apt-get`** (and `apt-cache` for
queries). Not because `apt` will break today, but because nothing promises it won't, and the
failure mode is a script that parses output fine for two years and then silently matches nothing
after an upgrade. Pass `-y` and set `DEBIAN_FRONTEND=noninteractive` while you are there.

**Ignore advice to prefer one for correctness.** They resolve dependencies identically, because
it is the same resolver. Anything claiming `apt` installs different packages than `apt-get` is
describing the `upgrade` difference above, not a difference in the underlying decision.

Neither replaces [`dpkg`](/debian/apt-essentials/), which sits underneath both and does not know
anything about repositories or dependency resolution.
