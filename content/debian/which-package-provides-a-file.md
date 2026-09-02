---
title: "Which package provides a file"
tagline: "Two commands, and how to tell which one you need"
description: "Trace a file to the package that ships it: dpkg -S for what is installed, apt-file for what is not, and the files that belong to no package at all."
category: debian
tags: [apt, debian, search, sysadmin, beginner]
updated: 2026-08-26
related: [apt-file, dpkg, apt, list-installed-packages]
---

A command you were told to run reports `command not found`, or a build stops on a header file
that is not where it expected. Both need the same answer, the name of a package that would put
the file there.

Debian answers that in two places, and which one to ask depends on whether the file is already on
the machine. dpkg keeps a record of every path it has unpacked, so searching it is instant and it
knows nothing beyond this machine. The archive's index covers every file in every package Debian
carries, and has to be downloaded before you can search it.

## dpkg -S: the file is already on the machine

```bash
dpkg -S $(command -v ls)
```
```
coreutils: /usr/bin/ls
```

Nothing is downloaded and no index is needed. When a package is unpacked, dpkg writes the list
of paths it placed into `/var/lib/dpkg/info/<package>.list`, and `-S` searches those files. It is
the same record [`dpkg -L`](/commands/dpkg/) reads in the other direction.

The `$(command -v ls)` is not decoration. Pass a bare name instead and `dpkg -S` matches it as a
substring, against every path it knows about:

<!-- verify: shape the count depends on which packages are installed -->
```bash
dpkg -S ls | wc -l
```
```
578
```

Locale files, manual pages and any path with those two letters in it. Passing the absolute path
narrows it to the one line you wanted, and `command -v` is how to get the absolute path of
something already on your `PATH`. For a manual page, [`man -w`](/commands/man/) prints the path
to feed in. A relative path never matches at all, because the lists hold
absolute ones.

## apt-file: the file is still in the archive

`ifconfig` is not installed on a modern Debian, and the guide telling you to run it is usually
old enough not to mention that:

```bash
dpkg -S /usr/sbin/ifconfig
```
```
dpkg-query: no path found matching pattern /usr/sbin/ifconfig
```

That says no package **on this machine** claims the path, which is not the same as no package
shipping it. For the archive-wide question, install [`apt-file`](/commands/apt-file/) and let
`apt update` fetch the `Contents` index it searches:

```bash
apt-file search bin/ifconfig
```
```
net-tools: /usr/sbin/ifconfig
```

The pattern is `bin/ifconfig` rather than a full path on purpose. `ifconfig` lived in `/sbin` for
twenty years and moved to `/usr/sbin` in the `/usr` merge, so searching the directory you remember
can come back empty while the file sits there under the other prefix.

Add `-l` when the answer is going straight into an install command:

```bash
apt-file search -l bin/ifconfig
```
```
net-tools
```

The same index answers the reverse question, which is worth asking before installing a package
you have not met:

```bash
apt-file list net-tools | head -4
```
```
net-tools: /usr/bin/netstat
net-tools: /usr/sbin/arp
net-tools: /usr/sbin/ifconfig
net-tools: /usr/sbin/ipmaddr
```

## Files that belong to no package

Some of what is on a Debian system never came out of a `.deb`, and both commands above will deny
all knowledge of it:

```bash
dpkg -S /etc/passwd
```
```
dpkg-query: no path found matching pattern /etc/passwd
```

`/etc/passwd` is built during installation from a template the `base-passwd` package ships as
`/usr/share/base-passwd/passwd.master`, and it changes every time an account is added, so
shipping it as a packaged file would mean overwriting your accounts on every upgrade. Log files
and anything else generated at first boot are absent for the same sort of reason.

The same is true of a command that is definitely installed:

```bash
readlink /usr/bin/editor
```
```
/etc/alternatives/editor
```

```bash
dpkg -S /usr/bin/editor
```
```
dpkg-query: no path found matching pattern /usr/bin/editor
```

`apt-file` has nothing for it either:

```bash
apt-file search -x 'bin/editor$' || echo "no package in the archive ships that path"
```
```
no package in the archive ships that path
```

The symlink is created by `update-alternatives` when a package registers itself as a candidate
editor, which happens in a maintainer script rather than in the package's file list. Ask the
alternatives system instead:

```bash
update-alternatives --query editor | head -3
```
```
Name: editor
Link: /usr/bin/editor
Slaves:
```

`/usr/bin/vi`, `/usr/bin/awk`, `/usr/bin/pager` and the rest of `/etc/alternatives` behave the
same way.

## command-not-found does the lookup for you

Debian packages the whole exercise above as `command-not-found`, which is not installed by
default:

```bash
/usr/lib/command-not-found ifconfig
```
```
Command 'ifconfig' not found, but can be installed with:
apt install net-tools
```

You would not normally type that. In an interactive shell, bash calls it through the
`command_not_found_handle` function defined in `/etc/bash.bashrc`, so the suggestion appears by
itself when you mistype a command or ask for one you have not installed.

It reads a database of its own rather than the `Contents` index directly, and that database is
built by `update-command-not-found`. On a fresh install it is empty, and the hook stays quiet
until you run that once.
