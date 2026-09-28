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
database is modelled on. On a default Debian install the file is the only source, so
`getent passwd tips-ops` prints the same line as `grep '^tips-ops:' /etc/passwd`. Once accounts
also come from LDAP, Active Directory or `systemd-homed`, the file holds only the local ones:
`getent` still finds the rest, and the `grep` finds nothing, without an error to say why.

Which sources are consulted, and in what order, is governed by `/etc/nsswitch.conf`. `getent` reads
it the way every other program on the system does, so a script that uses it sees the accounts a
login or a service would see. One that greps the file works on the machine it was written on and
finds nothing on a machine whose accounts live somewhere else.

The databases go well beyond accounts. `hosts`, `services` and `protocols` are the other three
worth knowing, and each saves opening a file under `/etc` and reading it by eye.
