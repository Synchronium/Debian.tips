---
title: "getent"
tagline: "Query the name service the rest of the system uses"
description: "Tested getent examples: passwd, group, hosts and shadow through NSS, the exit status a script reads, and the members a group listing leaves out."
category: commands
tags: [sysadmin, security, networking, debian]
updated: 2026-09-28
tier: light
related: [id, managing-users, grep, file-permissions-explained, filesystem-hierarchy]
---

`getent` asks the Name Service Switch for an entry and prints it in the format of the file that
database is modelled on. On a machine with nothing configured that is the file, and `getent passwd
tips-ops` is a slower `grep` of `/etc/passwd`. On a machine wired to LDAP, Active Directory or
`systemd-homed`, the file holds a fraction of the accounts and the `grep` quietly answers wrong.

Which sources are consulted, and in what order, is `/etc/nsswitch.conf`. `getent` reads it the way
every other program on the system does, which is the reason to prefer it: a script that greps a
file works on the machine it was written on and fails on the one it was deployed to, and fails by
finding nothing rather than by reporting an error.

The databases go well beyond accounts. `hosts`, `services` and `protocols` are the ones worth
knowing, because each answers a question people otherwise open a file to guess at.
