---
title: "The repository does not have a Release file"
tagline: "A 404 on one file, and three different reasons for it"
description: "apt asked a repository for dists/<suite>/Release and got a 404. Telling an archived release from a typo and from a flat repository, and what each one needs."
category: troubleshooting
tags: [apt, debian, sysadmin]
updated: 2026-09-15
related: [apt-update-failed, release-channels, third-party-repositories, apt]
---

<!-- verify: skip names an example repository that does not exist; reproduced below against a real one -->
```
E: The repository 'http://packages.example.com/debian stable Release' does not have a Release file.
N: Updating from such a repository can't be done securely, and is therefore disabled by default.
```

Most apt failures let the update finish. This one stops it, and says almost nothing about why. The
repository answered: it served a 404 for one particular file, and the three reasons it might have
done that need three different fixes.

## What apt asked for, and where

```bash
sudo apt-get update 2>/dev/null
```
```
Ign:1 http://deb.tips-mirror.example:8086 buster InRelease
Err:2 http://deb.tips-mirror.example:8086 buster Release
  404  File not found [IP: 127.0.0.1 8086]
Reading package lists...
```

Two fetches for what is one file to apt. `InRelease` is the modern form, the index with its
signature wrapped around it, and apt tries that first. `Ign` there is not a failure: a repository
is allowed to publish only the older pair, a `Release` file with a detached `Release.gpg` beside
it, so apt falls back rather than giving up. `Err:2` is that fallback also coming back 404, at
which point there is nothing left to try.

The URL apt built is worth being able to reconstruct:

```ini
URIs:   http://deb.tips-mirror.example:8086
Suites: buster
```

gives `http://deb.tips-mirror.example:8086/dists/buster/Release`. `dists/` is fixed, and the suite
is a directory name underneath it. So the error means that directory is not there.

```bash
sudo apt-get update 2>&1 >/dev/null; echo "exit: $?"
```
```
E: The repository 'http://deb.tips-mirror.example:8086 buster Release' does not have a Release file.
exit: 100
```

`E` rather than `W`, and exit 100. Every other source on the machine is refreshed, and the command
still fails, which [apt update failed](/troubleshooting/apt-update-failed/) covers along with the
prefixes and the streams they arrive on.

## Ask the server what it does have

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://deb.tips-mirror.example:8086/dists/buster/Release
curl -s -o /dev/null -w '%{http_code}\n' http://deb.tips-mirror.example:8086/dists/stable/Release
```
```
404
200
```

The answer places you in one of the three cases. A `404` for your suite and a `200` for another
one means the repository is healthy and your suite is not there:
either it never was, or it has been retired. Fetching `dists/` in a browser will usually list what
is, since most repositories leave directory indexes on.

A typo is the cheap explanation and worth ruling out first. `bookwork` for `bookworm`, or a
codename where the vendor publishes by role, are both this error and neither is interesting.
[Debian's release channels](/debian/release-channels/) has which names are codenames and which are
roles, and why a source may say either.

## A release that has been archived

Debian keeps a release on the mirror network while it is supported. When support ends the release
does not vanish, it moves: the files leave `deb.debian.org` and reappear on `archive.debian.org`,
which exists to serve exactly this. A machine still pointing at the mirror asks for a directory
that has been taken away. It happens to every unattended machine running a release that has aged
out.

Pointing the source at the archive gets part of the way there:

<!-- verify: shape the interval since the Release file expired grows with every run -->
```bash
sudo tee /etc/apt/sources.list.d/tips.sources >/dev/null <<'EOF'
Types: deb
URIs: http://archive.tips-mirror.example:8087
Suites: buster
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
sudo apt-get update 2>&1 >/dev/null; echo "exit: $?"
```
```
E: Release file for http://archive.tips-mirror.example:8087/dists/buster/InRelease is expired (invalid since 584d 14h 29min 16s). Updates for this repository will not be applied.
exit: 100
```

A different error, and progress: apt found the Release file this time and refused it. Every Release
file carries a `Valid-Until` date, and apt will not act on one that has passed. That check is there
so nobody can serve you a frozen copy of an old index to hide a security update from you, and on an
archived release it has passed by definition, because the release stopped being updated before the
date went by.

Then tell apt not to apply the check to that one repository:

```bash
sudo tee /etc/apt/sources.list.d/tips.sources >/dev/null <<'EOF'
Types: deb
URIs: http://archive.tips-mirror.example:8087
Suites: buster
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
Check-Valid-Until: no
EOF
sudo apt-get update >/dev/null 2>&1; echo "update exit: $?"
apt-cache policy tips-tool | head -3
```
```
update exit: 0
tips-tool:
  Installed: (none)
  Candidate: 1.0-1
```

`Check-Valid-Until: no` belongs in the stanza for the archived repository and nowhere else. The
global form, `Acquire::Check-Valid-Until "false";` in an `apt.conf` fragment, turns the check off
for every repository including the ones still getting security updates.

> [!WARNING]
> Being archived means the release receives no security updates. Reaching it again restores your
> ability to install packages, but it does not restore support. Do this while you plan the upgrade,
> not instead of it.

## A repository with no dists directory at all

Some vendors publish a **flat** repository: the packages and one `Packages` index sitting together
in a single directory, with no `dists/`, no suites and no components. It is a legitimate layout,
and a stanza written in the ordinary shape asks it for a path it has never had:

```bash
sudo tee /etc/apt/sources.list.d/tips.sources >/dev/null <<'EOF'
Types: deb
URIs: http://files.tips-vendor.example:8088
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
sudo apt-get update 2>&1 >/dev/null; echo "exit: $?"
```
```
E: The repository 'http://files.tips-vendor.example:8088 stable Release' does not have a Release file.
exit: 100
```

Identical to the archived case, from a repository that is working perfectly. The two curl requests
separate them:

```bash
curl -s -o /dev/null -w 'dists/stable/Release: %{http_code}\n' http://files.tips-vendor.example:8088/dists/stable/Release
curl -s -o /dev/null -w 'Packages at the root: %{http_code}\n' http://files.tips-vendor.example:8088/Packages
```
```
dists/stable/Release: 404
Packages at the root: 200
```

An index at the root and nothing under `dists/` is a flat repository. The stanza for one names the
directory as the suite, with a trailing slash and no components at all:

```bash
sudo tee /etc/apt/sources.list.d/tips.sources >/dev/null <<'EOF'
Types: deb
URIs: http://files.tips-vendor.example:8088
Suites: ./
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
sudo apt-get update >/dev/null 2>&1; echo "update exit: $?"
apt-cache policy tips-tool
```
```
update exit: 0
tips-tool:
  Installed: (none)
  Candidate: 1.0-1
  Version table:
     1.0-1 500
        500 http://files.tips-vendor.example:8088 ./ Packages
```

The `./` in the last line is where a suite and component would normally be printed. If the packages
sit in a subdirectory rather than at the root, that subdirectory goes in `Suites:` with the same
trailing slash, and `URIs:` keeps the part above it.

## When the suite is found and something else is not

A message beginning `Skipping acquire of configured file` and ending `doesn't have the component`
is the neighbouring mistake: apt read the Release file, so the suite is there, and the component
named beside it is not. `main`, `contrib` and `non-free-firmware` are Debian's; a vendor
repository often has exactly one and calls it something else. That one is a warning rather than an
error, so the update exits 0 and the packages are quietly missing.

For a source you are writing from scratch rather than repairing,
[adding a third-party repository safely](/debian/third-party-repositories/) has the stanza with
every field explained, and [`apt`](/commands/apt/) covers the update workflow the source feeds.
