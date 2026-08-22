---
title: "The following packages have been kept back"
description: "apt-get upgrade refuses to install new packages, so an upgrade that needs one is held back instead. What the message means and the three things that cause it."
category: troubleshooting
tags: [apt, debian, sysadmin, beginner]
updated: 2026-08-22
related: [apt, apt-vs-apt-get, apt-essentials, release-channels]
---

`apt-get upgrade` can finish successfully and still leave a package on its old version:

```
The following packages have been kept back:
  tips-demo
```

Running it again changes nothing.

## Why apt held the package back

`apt-get upgrade` upgrades packages you already have and **never installs a package you don't**.
An upgrade run cannot quietly add software to a machine.

So a newer version that needs a dependency you haven't got can't be installed under that rule.
Apt leaves the package alone and says so. "Kept back" means the upgrade was available, and taking
it would have needed more than an upgrade.

## Check whether a missing dependency explains it

Two commands. First, whether an upgrade is really available:

```bash
apt-cache policy tips-demo | head -3
```
```
tips-demo:
  Installed: 1.0-1
  Candidate: 2.0-1
```

Then what the newer version wants:

```bash
apt-cache depends tips-demo=2.0-1
```
```
tips-demo
  Depends: tips-extra
```

If `tips-extra` isn't installed, that's the dependency holding the upgrade back.

## Three ways to let the upgrade through

Any of these, in rough order of how much you should think first.

**Use `apt` instead of `apt-get`.** The `apt` front end installs new packages during an upgrade by
default; `apt-get` does not. The resolver is the same in both, so that default is the important
difference:

```bash
sudo apt upgrade -s | grep -A1 "Installing dependencies"
```
```
Installing dependencies:
  tips-extra
```

**Or tell `apt-get` to allow it.** In a script you want `apt-get`'s stable output with the same
behaviour:

```bash
sudo apt-get upgrade -s --with-new-pkgs | grep "^Inst tips"
```
```
Inst tips-extra (1.0-1 stable [all])
Inst tips-demo [1.0-1] (2.0-1 stable [all])
```

Drop the `-s` from either to do it for real.

**Or run `apt full-upgrade`.** This also works, and is the advice you will most often find, but it
is a bigger hammer than the problem needs: `full-upgrade` is additionally allowed to *remove*
packages to resolve dependencies. On a routine update that is more permission than you meant to
grant. Use it when upgrading between Debian releases, where it is the correct tool. See
[Debian's release channels](/debian/release-channels/).

> [!TIP]
> Simulate first, whichever you choose. `-s` prints the plan and changes nothing, and the line
> worth reading is anything under `REMOVING`.

## Holds and phased updates

The message is the same, so check these when the dependency explanation doesn't fit.

**The package is held.** A hold is a deliberate "never upgrade this", and it produces the
identical message. Ask which packages are held:

```bash
apt-mark showhold
```
```
ca-certificates
```

If the package you are chasing appears in that list, no amount of `--with-new-pkgs` will move it.
A hold outranks every fix above. Release it with `sudo apt-mark unhold <package>` and upgrade
again. Holds are easy to set and easy to forget, especially in a provisioning script written by
someone else.

**Phased updates.** Some updates are released to a percentage of machines at a time, so a machine
reports one as kept back purely because it hasn't been picked yet. This is an Ubuntu habit that
Debian stable has largely declined to pick up, which makes it the least likely of the three here.
The remedy is to wait until a rollout percentage somewhere decides you are worth including.

## When to leave it held back

Usually you should just fix it, but read what it wants first. The question the message is really
asking is *may I add something to this machine*. On a laptop, yes. On a server with a carefully
controlled package set, sometimes no, and the right response is to leave it held back and find out
why the new version needs what it needs.

What you should not do is ignore it indefinitely. A package kept back is a package not receiving
security updates, and [`unattended-upgrades`](/debian/release-channels/) will not resolve this for
you. It has the same rule about new packages that `apt-get upgrade` does.

## Avoiding it

- Interactively, use `apt upgrade` rather than `apt-get upgrade` and the situation resolves
  itself. See [apt vs apt-get](/compare/apt-vs-apt-get/) for the other differences.
- In scripts, use `apt-get upgrade --with-new-pkgs` deliberately, so the behaviour is written
  down rather than inherited from whichever command someone typed.
- Audit holds when you inherit a machine: `apt-mark showhold` takes a second and explains a
  surprising amount.

A different kind of upgrade failure, apt refusing a repository rather than a package, is covered
in [The repository is not signed](/troubleshooting/repository-is-not-signed/).
