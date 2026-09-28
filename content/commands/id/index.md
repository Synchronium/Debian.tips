---
title: "id"
tagline: "The account a process is running as, and its groups"
description: "Tested id examples: the three parts of the line, real against effective uid under a setuid binary, and the group a running shell has not picked up."
category: commands
tags: [permissions, security, sysadmin, beginner]
updated: 2026-09-28
tier: light
related: [managing-users, getent, chmod, file-permissions-explained, sudo]
---

`id` prints the credentials the kernel checks against, which is a different question from what the
prompt says or what `/etc/passwd` records: the uid, the primary group and the supplementary groups,
each as a number with its name in brackets.

Given a username it reads the account database instead of the running process, so `id` and
`id tips-ops` answer different questions. The gap between them is where most of the confusion
lives: a process is given its group list when it starts and never asks again, so a shell that was
open before someone ran `usermod -aG` keeps the old list until it exits.

`id -u` is the usual root test at the top of an install script, and the reason to prefer it is that
`$USER` is an ordinary variable anyone can set, while `whoami` answers about the effective uid and
has no way to say what the real one is.
