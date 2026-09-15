---
title: "Package installation failed"
tagline: "Unable to locate, unable to fetch, and which is which"
description: "apt install stops before dpkg runs. Telling a package apt has never heard of from one it cannot download, and why --fix-missing is rarely the answer."
category: troubleshooting
tags: [apt, debian, sysadmin]
updated: 2026-09-15
related: [apt, unmet-dependencies, apt-update-failed, apt-cache, disk-full]
---

An `apt install` that stops without installing anything fails in one of three places, and they are
worth separating before reaching for a fix. apt has to find the package in an index, download the
`.deb`, and hand it to dpkg. This page is about the first two. A refusal that names dependencies
happens earlier still, before any of this, and is
[unmet dependencies](/troubleshooting/unmet-dependencies/).

<!-- verify: skip the reader's own package name; both failures are reproduced below against a real repository -->
```
E: Unable to locate package some-package
```

## apt has never heard of it

```bash
sudo apt-get install -y tips-editor 2>&1 >/dev/null
```
```
E: Unable to locate package tips-editor
```

No repository apt knows about lists a package by that name. That is a statement about the indexes
on this machine rather than about the package, so it has three ordinary causes: the name is
misspelled, the index is missing because `apt update` has not run or did not finish, or the
repository that carries it is not configured.

Listing what the configured repositories do offer settles the first:

```bash
apt-cache pkgnames tips- | sort
```
```
tips-corrupt
tips-gone
tips-tool
```

`pkgnames` takes a prefix and prints every package name starting with it, which is the fastest way
to check a spelling. It reads the same indexes `apt install` does, so an empty result for a prefix
you are sure about points at the index rather than the name, and
[apt update failed](/troubleshooting/apt-update-failed/) covers an update that reported a problem
and carried on.

Where the package belongs to a repository you have not added, nothing on the machine can tell you
so. That is the case for a vendor's own software, and for anything in a component your sources do
not list: a source naming only `main` will not find a package in `contrib` on the same server.

## apt found it and could not fetch it

```bash
sudo apt-get install -y tips-gone 2>&1 >/dev/null; echo "exit: $?"
```
```
E: Failed to fetch http://packages.tips-vendor.example:8090/pool/main/tips-gone_1.0-1_all.deb  404  File not found [IP: 127.0.0.1 8090]
E: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?
exit: 100
```

A different failure entirely: the package was found, its dependencies resolved, and the download
404'd. The index and the pool disagree, which means the index on this machine describes a version
of the archive that no longer exists.

Most of the time the reason is dull: the index is old. A repository that publishes a new version
moves the old `.deb` out of the pool, and a machine whose last successful `apt update` predates the
move asks for a file that has been replaced. So the first of the two suggestions in that message is
usually right: run `apt update`, then the same install again.

It also happens in the other direction, on a mirror that is mid-sync and publishing an index newer
than the files beside it. There the fix is waiting, or using a different mirror.

## The file arrived and was not the file

<!-- verify: shape the two sizes depend on how the package was built -->
```bash
sudo apt-get install -y tips-corrupt 2>&1 >/dev/null | head -1
```
```
E: Failed to fetch http://packages.tips-vendor.example:8090/pool/main/tips-corrupt_1.0-1_all.deb  File has unexpected size (36 != 788). Mirror sync in progress? [IP: 127.0.0.1 8090]
```

apt records a size and several hashes for every file in the index and checks what arrives against
them. Here the download succeeded and produced something other than what the index described, so
apt stopped. Below this line it prints the hashes it expected, which are worth keeping if you need
to tell a mirror operator what you were served.

The causes are the same disagreement as the 404, seen from the other side, plus one more that the
message does not mention: something between you and the repository is serving a cached copy. A
transparent HTTP proxy, a corporate cache, or a local `apt-cacher-ng` holding a file from before
the archive moved on will all produce this, and none of them is fixed by `apt update`.

Clearing what apt has already downloaded is the first step, since a partial or bad file in the
cache is retried rather than refetched:

```bash
sudo apt-get clean
sudo apt-get update >/dev/null 2>&1; echo "update exit: $?"
```
```
update exit: 0
```

`apt-get clean` empties `/var/cache/apt/archives/`. It holds `.deb` files that were already
installed or only partly downloaded, so emptying it costs a re-download and nothing else.

## Why --fix-missing rarely helps

```bash
sudo apt-get install -y --fix-missing tips-gone 2>&1 >/dev/null | tail -1
```
```
E: Internal Error, ordering was unable to handle the media swap
```

The message apt suggests it with is more encouraging than the option deserves. `--fix-missing`
tells apt to carry on without the packages it could not download, which makes sense when you asked
for twenty packages and one mirror was briefly unavailable. When the package you asked for is the
one that is missing, there is nothing left to carry on with, and apt fails with that internal error
instead.

Use it when a large `apt upgrade` failed on one file and you want the rest of it, and not as a
second attempt at an install that just failed.

## When it is neither

Some failures in this area come from outside apt's own bookkeeping. A machine that has run out of
space fails partway through with a message naming the filesystem rather than the package, and
[no space left on device](/troubleshooting/disk-full/) is the page for that, including the case
where `df` reports free space and the install still fails. A failure that happens *after* the
download, with dpkg naming a package it was processing, is a maintainer script rather than an
archive problem, and the package is left half-configured in a way that the next `apt` run will
complain about until it is dealt with.

For what the two commands are and when each is safe in a script, see [`apt`](/commands/apt/).
