---
title: "passwd"
tagline: "Set, lock and expire an account's password"
description: "Tested passwd examples: setting a password from a script, reading the status line, what a locked password does not stop, and expiring an account instead."
category: commands
tags: [security, sysadmin, permissions]
updated: 2026-10-02
tier: standard
related: [chage, managing-users, id, getent, ssh, sudo]
---

Run with no arguments, `passwd` changes your own password, which requires the current one first.
Root can name any account and is never asked for the old password, which is how every example here
runs. The password itself never appears anywhere: `/etc/shadow` holds a one-way hash of it,
readable only by root, and `passwd` is one of the few programs allowed to write that file.

Most of the flags are about the state of the password rather than its value:

- `-l` locks it.
- `-e` forces a new one at the next login.
- `-d` removes it.
- `-S` prints a one-line summary of all of that.
- `-n`, `-x`, `-w` and `-i` set its ageing. They are the same settings
  [`chage`](/commands/chage/) changes, which reads and explains them better.

Locking is the part most often misunderstood. All `passwd -l` does is make the password impossible
to match. A login that does not use the password, such as an SSH key or `su` from root, carries on
working. To stop an account from being used at all, expire the account, which the examples on this
page show next to the lock.
[Managing users](/commands/managing-users/) covers creating and removing the accounts themselves.
