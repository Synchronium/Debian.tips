---
title: "cd"
tagline: "Change directory, and why it cannot be a program"
description: "Tested cd examples: why no program could do this job, what cd - and $OLDPWD hold, and the two different answers cd .. gives under a symlink."
category: commands
tags: [files, terminal, beginner]
updated: 2026-09-05
tier: light
related: [ls, mkdir, ln, terminal-shell-and-tty, environment-variables-and-path]
---

`cd` is built into the shell, and it has to be. A process can change only its own working
directory, so a `/usr/bin/cd` would start, move itself, exit, and leave the shell that called it
exactly where it was. The same reasoning explains why a script cannot move the shell that ran it,
and why `(cd elsewhere && …)` in brackets is the safe way to visit a directory.

Most of the flags are about symlinks. `cd` remembers the path you typed rather than where you
landed, so `$PWD` can name a link while `pwd -P` names the directory behind it, and `cd ..` walks
back up the path you typed rather than the one on disk. `-P` asks for the second answer
throughout.

There is no manual page, because there is no program. `help cd` is the documentation.
