---
title: "rm"
tagline: "Delete files and directories, with no undo"
description: "Tested rm examples: -r and -rf, why a directory's permissions decide what you may delete, and three ways a command removes more than the files you named."
category: commands
tags: [files, permissions, beginner]
updated: 2026-08-28
tier: light
related: [cp, mv, find, file-permissions-explained]
---

`rm` removes a name from a directory. There is no recycle bin on Debian, no undelete and no
confirmation, and the file is gone by the time the command returns.

What you may remove is decided by the mode on the *directory*, not the one on the file. You can
delete a read-only file out of a directory you can write, and you cannot delete your own file out
of a directory you cannot. `/tmp` would be unusable under that rule, and the sticky bit on it is
the exception that makes it work.

Most of the damage `rm` does comes from the arguments it was handed rather than the flags it was
given: a glob that matched more than you meant, a stray space, an unset variable. `rm -rf` doesn't report
any of it.
