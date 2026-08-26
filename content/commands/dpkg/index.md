---
title: "dpkg"
tagline: "Install and inspect Debian packages directly"
description: "Query what's installed, find which package owns a file, inspect a .deb before trusting it, and repair a half-finished install: the layer beneath apt."
category: commands
tier: flagship
tags: [apt, debian, sysadmin]
updated: 2026-08-18
related: [apt, apt-cache, list-installed-packages, apt-vs-apt-get, apt-essentials]
---

`dpkg` is the program that installs Debian packages. It unpacks a `.deb`, runs its
maintainer scripts, records which files it owns, and remembers what state each package is in.
Everything [`apt`](/commands/apt/) does ends in a `dpkg` run.

The difference explains most of what is frustrating about `dpkg` used alone: **`dpkg` knows
about packages, and `apt` knows about repositories.** `dpkg` works with one file you already
have. It cannot download anything, does not know what a repository is, and, the important one,
**will not resolve dependencies**. It
checks them, refuses to configure a package whose dependencies are missing, and tells you what
was missing. Finding and installing those is apt's job.

That single fact is behind the most common dpkg experience: `dpkg -i something.deb` fails with
a wall of `dependency problems`, and the fix is to let apt clean up after it.

## What dpkg is better at

Given that, most installing is better done through apt. What `dpkg` is for:

- **Asking what is installed**, and in what state. `dpkg -l`, `dpkg -s` and `dpkg -L` answer
  from the local database with no network involved at all, which also makes them the tools that
  still work on a machine whose networking or apt configuration is broken.
  [Listing what is installed](/debian/list-installed-packages/) is the tour of that question.
- **Finding which package owns a file.** `dpkg -S /path` is the fastest way to identify an
  unfamiliar file on a system, and it only sees files that are already there.
  [Which package provides a file](/debian/which-package-provides-a-file/) covers the other half,
  where the file is still in the archive.
- **Inspecting a `.deb` before installing it.** `dpkg -I` and `dpkg -c` read a package file
  without touching the system, which is exactly what you want for a `.deb` downloaded from
  somewhere you are not sure about.
- **Repairing.** `dpkg --configure -a` finishes work an interrupted install left half-done, and
  is often the entire fix after a machine lost power mid-upgrade or an install was killed.

## Reading package states

`dpkg -l` puts a two-letter state code in its first column, and it is the part people skip:

- **`ii`**: installed and configured. The normal state.
- **`rc`**: removed, but its configuration files are still on disk. This is what `apt remove`
  leaves behind, and why a package you "removed" can still be affecting things. `apt purge`
  clears it, and [remove vs purge vs autoremove](/compare/remove-vs-purge-vs-autoremove/) is
  when to pick which.
- **`iU`** or **`iF`**: unpacked or half-configured. Something went wrong; `dpkg --configure -a`
  is the usual repair.
- **`un`**: not installed, but known about, usually because something else references it.

The first letter is what you *wanted*, the second is what is true. When they disagree,
the package needs attention.

## Installing a .deb, and why you probably shouldn't

`dpkg -i file.deb` installs a package file directly. If its dependencies are already present it
works; if they are not, it unpacks the package, fails to configure it, and leaves it in a broken
state you then have to repair.

For that reason, prefer:

```sh
sudo apt install ./file.deb
```

The `./` is what makes apt treat it as a file rather than a package name. apt unpacks it through
dpkg exactly as `dpkg -i` would, but resolves and downloads the dependencies first, so the
install either completes or does not start. Use `dpkg -i` when apt is not available or not
working, which happens, and is the reason to know the command exists.
[Installing a .deb by hand](/debian/install-a-deb-file/) walks the whole sequence, including
what the broken state looks like and how to read the package before you run either command.

## `dpkg -l` is for reading, not parsing

`dpkg -l` is for reading, not parsing: its output is a fixed-width table that truncates the
description to the terminal width, and its exact columns are not a stable interface. When a
script needs a fact about a package, use `dpkg-query -W -f` and name the fields you want, or
test `dpkg -s` by exit status. Both are shown in the examples below.

Package operations need root. Every query on this page does not, and it is worth running them
unprivileged out of habit.
