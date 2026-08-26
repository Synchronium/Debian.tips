---
title: "apt-file"
tagline: "Which package ships a file you have not installed"
description: "Tested apt-file examples: searching Debian's file index for a command you have not installed, and the substring trap in a plain pattern."
category: commands
tags: [apt, debian, search, sysadmin]
updated: 2026-08-26
tier: light
related: [dpkg, apt-cache, apt, which-package-provides-a-file]
---

`apt-file` searches Debian's record of which package contains which file. The record covers the
whole archive rather than your disk, so it will name the package for a command nobody here has
installed. [`dpkg -S`](/commands/dpkg/) reads the file lists dpkg wrote when it unpacked each
package, and never sees past them.

The package is not part of a Debian install, so the first step is `apt install apt-file`.
Installing it drops a fragment into `/etc/apt/apt.conf.d/` asking apt to fetch the `Contents`
index, and until the next update there is nothing on disk to search: a query before that point
answers `E: The cache is empty. You need to run "apt-file update" first.`

A search then scans a few tens of megabytes and takes a second or so. `dpkg -S` answers in a few
tens of milliseconds, so try it first on any file that might already be installed.
