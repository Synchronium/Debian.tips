---
title: "apt upgrade vs full-upgrade vs dist-upgrade"
tagline: "Which upgrades may install, and which may remove"
description: "apt-get upgrade installs nothing new, apt upgrade installs but never removes, and full-upgrade does both. dist-upgrade is the same command under an older name."
category: compare
tags: [apt, debian, sysadmin]
updated: 2026-09-05
related: [apt, packages-kept-back, apt-vs-apt-get, release-channels]
---

The three differ on one axis: how much apt is allowed to disturb to get you the newer versions.
Two packages here have upgrades waiting. `tips-tool 2.0` needs a package that is not installed;
`tips-app 2.0` needs one that cannot be installed while `tips-legacy` is present.

`apt-get upgrade` will not install a new package under any circumstances, so both stay where they
are:

```bash
apt-get upgrade -s
```
```
Reading package lists...
Building dependency tree...
Reading state information...
Calculating upgrade...
The following packages have been kept back:
  tips-app tips-tool
0 upgraded, 0 newly installed, 0 to remove and 2 not upgraded.
```

"Kept back" is that refusal, and [the troubleshooting page](/troubleshooting/packages-kept-back/)
covers what to do about it when it happens on a real machine.

## apt upgrade is not apt-get upgrade

The `apt` front end changed the rule. It installs new packages when an upgrade needs them, and
still refuses to remove anything:

```bash
apt upgrade -s
```
```
Reading package lists...
Building dependency tree...
Reading state information...
Calculating upgrade...
Upgrading:
  tips-tool

Installing dependencies:
  tips-helper

Not upgrading:
  tips-app

Summary:
  Upgrading: 1, Installing: 1, Removing: 0, Not Upgrading: 1
Inst tips-helper (1.0-1 stable [all])
Inst tips-tool [1.0-1] (2.0-1 stable [all])
Conf tips-helper (1.0-1 stable [all])
Conf tips-tool (2.0-1 stable [all])
```

`tips-tool` upgraded and pulled `tips-helper` in with it. `tips-app` is still held, because
reaching its new version means removing `tips-legacy`, and no `upgrade` of either kind removes a
package.

So advice written for `apt-get` does not transfer. A guide from 2015 saying "`upgrade` never
installs anything new" describes a command that is still on your system under a different name.

## full-upgrade is allowed to remove

```bash
apt full-upgrade -s
```
```
Reading package lists...
Building dependency tree...
Reading state information...
Calculating upgrade...
Upgrading:
  tips-app  tips-tool

Installing dependencies:
  tips-helper  tips-lib

REMOVING:
  tips-legacy

Summary:
  Upgrading: 2, Installing: 2, Removing: 1, Not Upgrading: 0
Remv tips-legacy [1.0-1]
Inst tips-lib (1.0-1 stable [all])
Inst tips-app [1.0-1] (2.0-1 stable [all])
Inst tips-helper (1.0-1 stable [all])
Inst tips-tool [1.0-1] (2.0-1 stable [all])
Conf tips-lib (1.0-1 stable [all])
Conf tips-app (2.0-1 stable [all])
Conf tips-helper (1.0-1 stable [all])
Conf tips-tool (2.0-1 stable [all])
```

Nothing is held now. `REMOVING` is capitalised by apt because it is the part you are being asked
to read, and it is the reason `full-upgrade` is not the default: a dependency change upstream can
propose removing something you rely on, and the removal is what you have to check before
answering yes.

## dist-upgrade is the same command

`dist-upgrade` is `full-upgrade` under the name it had before apt got a friendlier front end. Both
front ends accept both spellings, and the plan they produce is byte for byte the same:

```bash
diff <(apt-get dist-upgrade -s) <(apt-get full-upgrade -s) && echo "dist-upgrade and full-upgrade: identical"
```
```
dist-upgrade and full-upgrade: identical
```

The name is misleading, which is why it was replaced. `dist-upgrade` does not move you between
Debian releases: what moves you is editing your sources to name the new suite, and `dist-upgrade`
is then the command you run afterwards because it is the one allowed to remove things.
[Release channels](/debian/release-channels/) covers that procedure.

## Which to use

**`apt upgrade`** for routine updates on a stable machine, after `apt update`. It takes everything
that can be had without removing anything, and a package it declines to upgrade is a package worth
a moment's attention rather than an error.

**`apt full-upgrade`** when something has been held back and you have read why, and always as part
of moving between releases. Read the `REMOVING` list before you answer.

**`apt-get upgrade`** in a script, and for that reason only: `apt-get` has a stable command line
across versions where `apt` does not promise one, which is the distinction
[apt vs apt-get](/compare/apt-vs-apt-get/) is about. Its stricter rule is a side effect of its age
rather than a safety feature you are choosing.

**Never `apt full-upgrade` unattended** on a machine you care about. The one thing it can do that
the others cannot is exactly the thing nobody wants to discover afterwards.
