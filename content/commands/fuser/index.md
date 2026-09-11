---
title: "fuser"
tagline: "Identify processes using a file, directory or socket"
description: "Tested fuser examples: which processes hold a file, what is keeping a filesystem busy, reading the access letters, and killing the holders with -k."
category: commands
tags: [processes, files, sysadmin]
updated: 2026-09-11
tier: light
related: [lsof, kill, ps, processes-and-signals, kill-whatever-is-using-a-port]
---

`fuser` names the processes using a file, a directory or a socket. It answers a narrower question
than [lsof](/commands/lsof/), and it comes with `-k`, which signals everything it found without a
process id ever being typed.

Its output is split across two streams, which can catch people out. The process ids go to standard
output; the filename, the access letters and everything `-v` adds go to standard error. Redirecting
one leaves you holding the other, which is why every example here sends one somewhere explicit.

`-m` widens a path to the whole filesystem mounted there, which is the form to run when `umount`
says a device is busy. `-s` prints nothing at all and puts the answer in its exit status.
