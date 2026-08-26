---
title: "APT essentials"
tagline: "update, upgrade, install, remove, and dpkg underneath"
description: "The apt, apt-get, and dpkg commands that cover almost everything you'll do to manage packages on Debian, and how remove differs from purge."
category: debian
tags: [apt, debian, sysadmin]
updated: 2026-08-22
related: [release-channels, third-party-repositories, systemd-services, systemctl, exit-codes-and-error-handling]
---

`apt` is the command-line front end for Debian's package management system: installing,
removing, updating, and inspecting the software on your system. Underneath it sits `dpkg`, which
unpacks and configures individual `.deb` packages. `apt` adds dependency resolution and
downloading from configured repositories on top.

## Keeping the system current

```bash
sudo apt update              # refresh the local package index from your configured sources
sudo apt upgrade             # install newer versions of already-installed packages
sudo apt full-upgrade        # like upgrade, but allowed to add/remove packages to resolve dependencies
```

`apt update` doesn't install anything. It downloads the latest list of available package
versions from your sources, and nothing on your system changes until you run `upgrade`. Use
`full-upgrade` (the successor to `dist-upgrade`) when a security update needs to remove an
obsolete package or install a new dependency that plain `upgrade` won't touch on its own.

Which versions any of this offers you depends on the channel the machine tracks, and on whether
its sources name a codename or a role: a machine pointed at `stable` rather than `trixie` starts
upgrading itself to the next Debian release the day that release happens. See
[Debian's release channels](/debian/release-channels/) for what each one is for.

## Installing, removing, and the difference between remove and purge

```bash
sudo apt install cowsay      # install a package
sudo apt remove cowsay       # uninstall it, leaving configuration files in place
sudo apt purge cowsay        # uninstall it AND delete its configuration files
sudo apt autoremove          # clean up dependencies nothing else needs any more
```

A package that ships a service usually starts it for you and enables it at boot, which is a
Debian convention rather than something `apt` does universally. Check rather than assume:
[`systemctl is-enabled <name>`](/commands/systemctl/) answers it in one word.
[Managing services with systemd](/debian/systemd-services/) covers that convention in full,
including the enable state Debian remembers across a `remove` but not a `purge`.

`remove` and `purge` look interchangeable for a package with no configuration to speak of, but
the distinction still holds and `dpkg` shows it directly. After removing (not purging) a package
that ships config files:

```bash
dpkg -s nano | head -2
```
```
Package: nano
Status: deinstall ok config-files
```

`config-files` is the state: the package's binaries are gone, but `/etc/nanorc` and similar
files are still on disk, in case you reinstall later and want your settings back. `dpkg -l`
abbreviates it to `rc` in its first column. `purge` clears that state entirely, deleting those
leftover files.

For a package you're getting rid of for good, `purge` is the more complete cleanup; for one
you're likely to reinstall, plain `remove` avoids losing configuration you might want back.
`autoremove` sits on a different axis again, acting on packages nobody asked for rather than on
how much of one to delete. See
[remove vs purge vs autoremove](/compare/remove-vs-purge-vs-autoremove/) for the full comparison.

## Searching and inspecting

```bash
apt search "text editor"        # search package names and descriptions
apt show curl                   # show a package's description, version, and dependencies
apt list --installed            # list every package currently installed
apt list --upgradable            # list packages with a newer version available
```

`apt list --installed` on a real system prints thousands of lines, so it is nearly always worth
narrowing with [`grep`](/commands/grep/). `apt list --installed | grep -i python` answers "is
this here, and which version" faster than `apt show` and a guess at the package name.

Beyond `apt` itself, `dpkg` answers questions about packages already on your system without
touching the network at all:

```bash
dpkg -l curl                       # is it installed, and what version?
dpkg -L curl                       # what files did it put on disk?
```

`dpkg -S` answers the question the other way round, naming the package a given file came from:

```bash
dpkg -S /usr/bin/curl
```
```
curl: /usr/bin/curl
```

Use it when you find an unfamiliar file or command on a system and want to know what installed
it, without a search engine.

## Previewing a change before it happens

`--simulate` prints its plan among the usual progress chatter, so the summary is the part to
read:

<!-- verify: shape the counts depend on how much of your system is currently out of date -->
```bash
apt-get install --simulate ripgrep | grep -E "^(The following|  ripgrep|[0-9]+ upgraded)"
```
```
The following NEW packages will be installed:
  ripgrep
0 upgraded, 1 newly installed, 0 to remove and 1 not upgraded.
```

Run without the `grep`, it also prints an `Inst` and a `Conf` line naming the exact version and
repository each package would come from.

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
the system and a newer one might not. `upgrade` and `full-upgrade` both skip held packages
automatically, so there is nothing to remember at upgrade time. It is also a common reason for
[a package being kept back](/troubleshooting/packages-kept-back/) months later.

<!-- verify: shape the version moves whenever a security update lands -->
```bash
apt-cache policy curl | head -3
```
```
curl:
  Installed: 8.14.1-2+deb13u4
  Candidate: 8.14.1-2+deb13u4
```

[`apt-cache policy`](/commands/apt-cache/) shows the installed version alongside the candidate
version `apt` would
install or upgrade to. Without the `head -3` it goes on to list every version available and the
repository each comes from, which is the fastest way to answer "why isn't this upgrading" or
"which repo is this version actually coming from" without digging through
`/etc/apt/sources.list.d/` by hand. It is also the check to run after adding a
vendor's repository, because a repository can offer any package name it likes:
[Adding a third-party repository safely](/debian/third-party-repositories/) covers what that
means and how to contain it.

> [!TIP]
> `apt` (no suffix) is meant for interactive use: coloured output, a progress bar, and an
> explicit warning that its output format isn't guaranteed stable between versions. Scripts
> should prefer `apt-get`/`apt-cache`, whose plain-text output is considered a stable interface
> `apt` deliberately isn't. [apt vs apt-get](/compare/apt-vs-apt-get/) has the full comparison,
> including the one place the two behave differently.

For the full command reference rather than the essentials, see [`apt`](/commands/apt/).

A script installing packages also needs `-y`, or `apt-get` stops at a prompt nobody is there to
answer, and needs to check that the install succeeded rather than carrying on with a
missing binary. See [Exit codes and error handling](/concepts/exit-codes-and-error-handling/)
for the pattern.

It also needs to cope with not being the only thing installing packages. On a machine running
automatic updates, an install can fail outright because something else got there first. See
[Could not get lock /var/lib/dpkg/lock-frontend](/troubleshooting/could-not-get-lock-dpkg-frontend/),
which is a race worth handling with a timeout rather than a retry loop.
