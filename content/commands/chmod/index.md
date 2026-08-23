---
title: "chmod"
tagline: "Change file and directory permissions"
description: "Tested chmod examples: numeric and symbolic modes, recursive changes, setuid/setgid/sticky bits, permission audits, and troubleshooting."
category: commands
tags: [permissions, files, security]
updated: 2026-08-12
tier: standard
related: [file-permissions-explained, find]
---

`chmod` changes who can read, write, or execute a file or directory. Every file has three
permission classes (owner, group, and everyone else), and `chmod` sets them either as a
three-digit **numeric mode** (`chmod 644 file`) or as a targeted **symbolic** edit (`chmod u+x
file`). For the full owner/group/other model, what each bit means on a directory, and how
`umask` fits in, see [File permissions explained](/concepts/file-permissions-explained/).

## Numeric mode replaces all nine bits

Numeric mode is one octal digit per class (owner, group, other), where `r`=4, `w`=2, and `x`=1
sum together: `chmod 755 script.sh` gives the owner `rwx` (7) and group/other `r-x` (5) each.
It's fast once the arithmetic is automatic, but it always sets all nine bits in one go,
discarding whatever combination was there before.

## Symbolic mode changes one and leaves the rest

Symbolic mode names a class (`u`, `g`, `o`, or `a`), an operator (`+`, `-`, `=`), and a
permission letter: `chmod u+x script.sh` adds execute for the owner only, without touching
anything else. Use symbolic mode when you want to flip one bit rather than recompute the
whole three-digit number from scratch.

## Recursive changes need care

`chmod -R` applies a mode to a directory and everything inside it, files and subdirectories
alike, in one pass. That includes anything whose permissions were deliberately tighter than the
rest of the tree (a private key sitting inside a project directory, say), and there's no
built-in undo once it's done. The examples below show a type-aware alternative, using `find`,
before the blunt `-R` version and the failure mode it produces.

## Permissions aren't the only gate

A permission-denied error doesn't always mean the file's own mode is wrong. Reading, writing, or
deleting a file also depends on the permissions of every directory between it and the
filesystem root, and deleting a file is governed by the *directory's* write permission, not the
file's. The troubleshooting section below walks through both.
