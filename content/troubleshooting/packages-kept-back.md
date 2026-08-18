---
title: "The following packages have been kept back"
description: "apt-get upgrade refuses to install new packages, so an upgrade that needs one is held back instead. What the message means and the three things that cause it."
category: troubleshooting
tags: [apt, debian, sysadmin, beginner]
updated: 2026-08-18
related: [apt, apt-vs-apt-get, apt-essentials, release-channels]
---

You ran an upgrade, it did most of its work, and then said this:

```
The following packages have been kept back:
  tips-demo
```

Nothing failed. Nothing is broken. But the package you probably cared about is still on its old
version, and running the same command again changes nothing.

## What it means

`apt-get upgrade` will upgrade packages you already have, and it will **never install a package
you don't**. That rule is the whole feature: an upgrade run should not be able to quietly add
software to a machine.

So when a newer version of something needs a *new* dependency that isn't installed yet, apt has
two choices — break its own rule, or leave that one package alone. It leaves it alone, and tells
you it did. "Kept back" means "this had an upgrade available, and taking it would have needed
more than an upgrade".

The message is apt being careful, not apt being stuck.

## Confirm that's the cause

Two commands. First, that an upgrade really is available:

```bash
apt-cache policy tips-demo | head -3
```
```
tips-demo:
  Installed: 1.0-1
  Candidate: 2.0-1
```

Then, what the newer version wants that you don't have:

```bash
apt-cache depends tips-demo=2.0-1
```
```
tips-demo
  Depends: tips-extra
```

If `tips-extra` isn't installed, you have found it. That dependency is the entire reason the
package is being held back.

## The fix

Any of these, in rough order of how much you should think first.

**Use `apt` instead of `apt-get`.** The `apt` front end installs new packages during an upgrade
by default — that difference, and not the resolver, is the main behavioural gap between the two
commands:

```bash
sudo apt upgrade -s | grep -A1 "Installing dependencies"
```
```
Installing dependencies:
  tips-extra
```

**Or tell `apt-get` to allow it**, which is the right choice in a script, where you want
`apt-get`'s stable output but the same behaviour:

```bash
sudo apt-get upgrade -s --with-new-pkgs | grep "^Inst tips"
```
```
Inst tips-extra (1.0-1 stable [all])
Inst tips-demo [1.0-1] (2.0-1 stable [all])
```

Drop the `-s` from either to do it for real.

**Or run `apt full-upgrade`.** This also works, and is the advice you will most often find, but
it is a bigger hammer than the problem needs: `full-upgrade` is additionally allowed to *remove*
packages to resolve dependencies. On a routine update that is more permission than you meant to
grant. Reach for it when upgrading between Debian releases, where it is the correct tool — see
[Debian's release channels](/debian/release-channels/).

> [!TIP]
> Simulate first, whichever you choose. `-s` prints the plan and changes nothing, and the line
> worth reading is anything under `REMOVING`.

## The other two causes

The message is the same, so check these when the dependency explanation doesn't fit.

**The package is held.** A hold is a deliberate "never upgrade this", and it produces the
identical message. Ask which packages are held:

```bash
apt-mark showhold
```
```
ca-certificates
```

If the package you are chasing appears in that list, no amount of `--with-new-pkgs` will move
it — a hold outranks all of the fixes above. Release the hold
with `sudo apt-mark unhold <package>` and upgrade again. Holds are easy to set and easy to
forget, especially in a provisioning script written by someone else.

**Phased updates.** Some updates are deliberately rolled out to a percentage of machines at a
time, and a machine outside the current percentage reports the update as kept back until its
turn arrives. This is mostly an Ubuntu behaviour; Debian stable does not generally phase its
updates, so on Debian this is the least likely of the three. If you suspect it, waiting is the
correct response — the update will arrive on its own.

## Should you just fix it?

Usually yes, but read what it wants first. "Kept back" is the one apt message that is asking you
a question rather than reporting a problem, and the question is *may I add something to this
machine*. On a laptop the answer is almost always yes. On a server with a carefully controlled
package set, the honest answer is sometimes no, and the right response is to leave it held back
and find out why the new version needs what it needs.

What you should not do is ignore it indefinitely. A package kept back is a package not receiving
security updates, and [`unattended-upgrades`](/debian/release-channels/) will not resolve this
for you — it has the same rule about new packages that `apt-get upgrade` does.

## Avoiding it

- Interactively, use `apt upgrade` rather than `apt-get upgrade` and the situation resolves
  itself. See [apt vs apt-get](/compare/apt-vs-apt-get/) for the other differences.
- In scripts, use `apt-get upgrade --with-new-pkgs` deliberately, so the behaviour is written
  down rather than inherited from whichever command someone typed.
- Audit holds when you inherit a machine: `apt-mark showhold` takes a second and explains a
  surprising amount.
