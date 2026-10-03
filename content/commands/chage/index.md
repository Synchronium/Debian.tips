---
title: "chage"
tagline: "When a password expires, and when the account does"
description: "Tested chage examples: reading the ageing settings, expiring passwords on a schedule, forcing a change, and expiring the whole account on a date."
category: commands
tags: [security, sysadmin, permissions]
updated: 2026-10-02
tier: light
related: [passwd, managing-users, getent, id]
---

`chage` reads and sets the dates in `/etc/shadow`: when the password was last changed, how long it
may be kept, how much warning comes before it expires, how long after that the account can still
log in to change it, and a date on which the whole account stops working. `chage -l` prints those
settings worked out into dates, which is the easiest way to find out why a login is being refused.

Every limit except the account's own expiry is counted from the last change, so setting a maximum
age on a password that is already old can expire it immediately. The account's expiry date is fixed,
and it is separate from the password: an expired account cannot log in by any route, where an
expired or [locked](/commands/passwd/) password only stops the password itself. Root can change
any account's settings, and an ordinary user can read their own.
