---
title: "apt"
tagline: "Install, remove and update Debian packages"
description: "Search, install, remove and upgrade packages with apt — including how to see what it will do before it does it, and which commands are safe in a script."
category: commands
tier: flagship
tags: [apt, debian, sysadmin, beginner]
updated: 2026-08-18
related: [apt-vs-apt-get, apt-essentials, third-party-repositories, could-not-get-lock-dpkg-frontend]
---

`apt` is the command you will type more than any other on a Debian system. It resolves
dependencies, fetches packages from the repositories configured in `/etc/apt/sources.list.d/`,
and hands them to `dpkg` to unpack and configure — then keeps the whole set consistent as
things change underneath it.

It is worth being precise about what `apt` actually is, because the naming is genuinely
confusing. `apt` is one of several front ends to the same library: `apt-get` and `apt-cache` are
the older, script-stable pair, and `apt` gathers the most-used parts of both behind one name
with nicer defaults. They are shipped by the same package and share a dependency resolver, so
they never disagree about what should be installed —
[apt vs apt-get](/compare/apt-vs-apt-get/) covers the differences that are real.

Underneath sits [`dpkg`](/debian/apt-essentials/), which installs a single `.deb` file and knows
nothing about repositories, dependencies or where a package came from. Almost every apt command
ends in a dpkg run, which is why dpkg's errors surface through apt.

## The two-step model

Nearly every mistake with apt comes from forgetting that it works from a cached copy of what
the repositories contain, not from the repositories themselves:

- **`apt update`** refreshes that cache. It changes nothing about what is installed.
- **`apt install` / `apt upgrade`** act on the cache as it currently stands.

So `apt install` immediately after a fresh install of Debian, without an `apt update` first, can
fail to find a package that plainly exists, or offer you a version that was superseded weeks
ago. When something is missing or stale, `apt update` is nearly always the first thing to try.
[Debian's release channels](/debian/release-channels/) covers what those repositories are and
how a package gets into one.

## Seeing what will happen first

Every state-changing apt command prints its plan and waits for confirmation, and reading that
plan is the single most valuable habit on this page. It tells you what is about to be
**installed**, **upgraded**, **removed** and — the line worth reading twice — what is
**no longer required**.

`-s` (`--simulate`, also spelled `--dry-run`) goes further: it prints the plan and exits without
touching anything, needing no root. Use it whenever a command is going to remove something, or
when you are working from instructions you do not fully trust.

## Which one is safe in a script

`apt` is designed for people. It says so itself: run any `apt` command with its output piped
somewhere and it prints a warning that its command-line interface is not stable between
versions. In a script, in a Dockerfile, in a systemd unit or in cron, use `apt-get` and
`apt-cache`, whose output formats are treated as an interface and kept still. Add `-y`, set
`DEBIAN_FRONTEND=noninteractive`, and check the exit status — see
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/).

Scripts also have to cope with not being the only thing installing packages: on a machine
running automatic updates, apt can fail outright because something else holds the dpkg lock.
[Could not get lock /var/lib/dpkg/lock-frontend](/troubleshooting/could-not-get-lock-dpkg-frontend/)
explains the timeout that fixes it properly.

## Root, and when you don't need it

Anything that changes installed packages needs root, normally through `sudo`. Anything that only
reads — `search`, `show`, `list`, `policy`, and any `--simulate` run — does not, and it is worth
getting into the habit of running those unprivileged. The examples below mark which is which.
