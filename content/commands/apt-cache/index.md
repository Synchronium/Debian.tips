---
title: "apt-cache"
tagline: "Search and inspect packages without installing them"
description: "Search the package cache, read a package's record, follow its dependencies, and use policy to see which version apt would install and from where."
category: commands
tier: standard
tags: [apt, debian, sysadmin]
updated: 2026-08-26
related: [apt, dpkg, apt-essentials, third-party-repositories]
---

`apt-cache` answers questions about packages without changing any of them. Everything it knows
came out of the last `apt update`, so its queries need neither the network nor root. Most of what
it can describe is software this machine has never had.

## Which version you would get

`apt-cache policy <package>` prints what is installed now and what `apt install` would fetch. If
those two lines differ, an upgrade is available and nobody has applied it. A candidate of
`(none)` means apt has the name and no version to go with it, which is the failure behind
"Package has no installation candidate".

Under them comes the version table, one line per version apt can see. Each carries the priority
that ranked it and the repository it came from, and the entry at priority 100 pointing to
`/var/lib/dpkg/status` is whatever is installed. Read the table when a machine is being offered
something you did not expect. The answer is usually a repository someone added, and
[third-party repositories](/debian/third-party-repositories/) covers pinning one back down.

## What the cache holds, and when it was filled

`apt update` fetches the repository indexes into `/var/lib/apt/lists/`, and apt compiles those
into the index `apt-cache` reads. Nothing here goes near the network, so the answers are as old
as that update: a package apt-cache claims not to know about is usually a machine that has not
run [`apt update`](/commands/apt/) since the archive moved.

Describing a package is not evidence of having it. `apt-cache show` will print the full record
for something [`dpkg -s`](/commands/dpkg/) has never heard of.

## apt-cache or apt

`apt search` and `apt show` are the same queries with the output laid out for reading, and at a
prompt they are usually what you want. `apt-cache` is the one to call from a script, for the
reason [apt vs apt-get](/compare/apt-vs-apt-get/) goes into: apt's command-line interface is not
stable between versions, so it shouldn't be relied upon in a script. It will print a warning to
remind you.

## What it cannot tell you

[`dpkg -S`](/commands/dpkg/) names the package a file on disk came from, out of what dpkg
recorded when it unpacked it. That only reaches packages you have installed. For a file you do
not have yet, [`apt-file search`](/commands/apt-file/) answers the same question, and the command
is not installed by default. Installing the `apt-file` package also adds the archive's Contents
index to what `apt update` fetches, so the sequence is install, update, then search.
