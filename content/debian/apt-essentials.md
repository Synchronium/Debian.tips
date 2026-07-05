---
title: "APT essentials"
description: "The apt, apt-get, and dpkg commands that cover almost everything you'll do to manage packages on Debian, and how remove differs from purge."
category: debian
tags: [apt, debian, sysadmin]
updated: 2026-07-05
---

`apt` is the command-line front end for Debian's package management system: installing,
removing, updating, and inspecting the software on your system. Underneath it sits `dpkg`, which
actually unpacks and configures individual `.deb` packages; `apt` adds dependency resolution and
downloading from configured repositories on top.

## Keeping the system current

```bash
sudo apt update              # refresh the local package index from your configured sources
sudo apt upgrade             # install newer versions of already-installed packages
sudo apt full-upgrade        # like upgrade, but allowed to add/remove packages to resolve dependencies
```

`apt update` doesn't install anything. It downloads the latest list of available package
versions from your sources. Nothing on your system actually changes until you run `upgrade`.
`full-upgrade` (the successor to `dist-upgrade`) is what you want when a security update needs
to remove an obsolete package or install a new dependency that plain `upgrade` won't touch on
its own.

## Installing, removing, and the difference between remove and purge

```bash
sudo apt install cowsay      # install a package
sudo apt remove cowsay       # uninstall it, leaving configuration files in place
sudo apt purge cowsay        # uninstall it AND delete its configuration files
sudo apt autoremove          # clean up dependencies nothing else needs any more
```

`remove` and `purge` look interchangeable for a package with no configuration to speak of, but
the distinction is real and `dpkg -l` shows it directly. After removing (not purging) a package
that ships actual config files:

```bash
dpkg -l nano
```
```
rc  nano           8.4-1+deb13u1 amd64        small, friendly text editor inspired by Pico
```

The `rc` in the first column means "removed, config files remain": the package's binaries are
gone, but `/etc/nanorc` and similar files are still on disk, in case you reinstall later and
want your settings back. `purge` clears that `rc` state entirely, deleting those leftover files.
For a package you're getting rid of for good, `purge` is the more complete cleanup; for one
you're likely to reinstall, plain `remove` avoids losing configuration you might want back.

## Searching and inspecting

```bash
apt search "text editor"        # search package names and descriptions
apt show curl                   # show a package's description, version, and dependencies
apt list --installed            # list every package currently installed
apt list --upgradable            # list packages with a newer version available
```

Beyond `apt` itself, `dpkg` answers questions about packages already on your system without
touching the network at all:

```bash
dpkg -l curl                       # is it installed, and what version?
dpkg -L curl                       # what files did it put on disk?
dpkg -S /usr/bin/curl              # which package owns this file?
```
```
curl: /usr/bin/curl
```

`dpkg -S` is the one to reach for when you find an unfamiliar file or command on a system and
want to know what installed it, without a search engine.

## Previewing a change before it happens

```bash
apt-get install --simulate ripgrep
```
```
The following NEW packages will be installed:
  ripgrep
0 upgraded, 1 newly installed, 0 to remove and 16 not upgraded.
Inst ripgrep (14.1.1-1+b4 Debian:13.5/stable [amd64])
Conf ripgrep (14.1.1-1+b4 Debian:13.5/stable [amd64])
```

`--simulate` (or `-s`) shows exactly what an install, remove, or upgrade would do, including
knock-on dependency changes, without actually doing it. Worth running before any change on a
system you can't easily roll back, particularly `full-upgrade`.

## Pinning a package so upgrades leave it alone

```bash
sudo apt-mark hold ripgrep     # exclude from future upgrade/full-upgrade runs
apt-mark showhold              # list everything currently held
sudo apt-mark unhold ripgrep   # allow it to upgrade again
```

A hold is useful when a specific version of a package is known to work with something else on
the system and a newer one might not; `upgrade` and `full-upgrade` both skip held packages
automatically, without needing to remember to exclude them manually each time.

```bash
apt-cache policy curl
```
```
curl:
  Installed: 8.14.1-2+deb13u3
  Candidate: 8.14.1-2+deb13u3
  Version table:
 *** 8.14.1-2+deb13u3 500
```

`apt-cache policy` shows the installed version alongside the candidate version `apt` would
install or upgrade to, plus which repository it would come from. This is the fastest way to
answer "why isn't this upgrading" or "which repo is this version actually coming from" without
digging through `/etc/apt/sources.list.d/` by hand.

> [!TIP]
> `apt` (no suffix) is meant for interactive use: coloured output, a progress bar, and an
> explicit warning that its output format isn't guaranteed stable between versions. Scripts
> should prefer `apt-get`/`apt-cache`, whose plain-text output is considered a stable interface
> `apt` deliberately isn't.
