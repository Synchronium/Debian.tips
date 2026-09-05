---
title: "adduser, useradd and friends"
tagline: "Accounts, groups and passwords on a Debian system"
description: "Tested examples for adduser, useradd, usermod, deluser and the group commands: why Debian ships two of each, and the -aG that silently drops every other group."
category: commands
tags: [permissions, security, sysadmin, debian]
updated: 2026-09-05
tier: standard
related: [chown, sudo, chmod, file-permissions-explained, su-vs-sudo-i-vs-sudo-s]
---

Debian ships two tools for every job here, and they are not alternatives. `useradd`, `usermod`,
`userdel`, `groupadd` and `groupdel` come from `passwd` and are the low-level interface: they do
exactly what the flags say and nothing else. `adduser`, `deluser`, `addgroup` and `delgroup` are
Debian's own Perl wrappers around them, and they apply the policy in `/etc/adduser.conf`, which is
what makes a new account usable rather than merely present.

The practical rule is `adduser` for a person and `useradd` in a script that needs to control every
field itself. `useradd bob` produces an account with `/bin/sh`, no home directory on disk and no
password, which is legal, hard to spot and almost never what was meant.

Modern `adduser` is nearly silent on success, so the examples below check the result rather than
trusting the absence of an error.

Two things on this page will bite you rather than fail loudly: `usermod -G` without the `a`
replaces every supplementary group an account has, and `deluser <user> <group>` refuses to work at
all when either name contains a hyphen.
