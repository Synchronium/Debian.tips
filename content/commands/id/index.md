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

`id` prints the credentials the kernel checks against, which can differ from what the prompt shows
and from what `/etc/passwd` records: the uid, the primary group and the supplementary groups, each
as a number with its name in brackets.

Given a username, it reads the account database instead of the running process, so `id tips-ops`
reports what that account is entitled to, and a bare `id` reports what this process actually holds.
The gap between them is where most of the confusion
lives: a process is given its group list when it starts and never asks again, so a shell that was
open before someone ran `usermod -aG` keeps the old list until it exits.

`id -u` is the usual root test at the top of an install script, because it prints the number the
kernel checks. The other test you will meet is `[ "$USER" = root ]`. `$USER` is an environment
variable holding the login name, filled in when the session starts, and it is only a variable: any
account can run `USER=root ./install.sh` and the script will believe it. `whoami` asks the kernel
rather than the environment, but it prints a name rather than the number, and it knows only the
effective uid, never the real one.
