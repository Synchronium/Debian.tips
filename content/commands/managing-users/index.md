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
Debian's own Perl wrappers around them. The wrappers apply the policy in `/etc/adduser.conf`, and
that policy is the difference between an account that exists and one somebody can use.

Use `adduser` for a person and `useradd` in a script that needs to control every field itself.
`useradd bob` produces an account with `/bin/sh`, no home directory on disk and no password, which
is legal, hard to spot and almost never what was meant.

Modern `adduser` prints nothing on success, so the examples below read the result back instead of
trusting the absence of an error.

Two things here will bite you without failing: `usermod -G` without the `a` replaces every
supplementary group an account has, and `deluser <user> <group>` refuses to work at all when either
name contains a hyphen.
