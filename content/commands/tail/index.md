---
title: "tail"
tagline: "Show the last part of a file, or follow it live"
description: "Tested tail examples: -n and -c, the +N form that counts from the start, following a growing file with -f, and why log rotation needs -F instead."
category: commands
tags: [text-processing, monitoring, sysadmin]
updated: 2026-08-23
tier: standard
related: [head, cat, grep, journalctl, monitor-a-log-in-real-time]
---

`tail` prints the last 10 lines of each file it is given, or of standard input. `-n` changes the
count, `-c` counts bytes, and several files each get a `==> filename <==` header that `-q`
suppresses.

That much mirrors [`head`](/commands/head/). Two things do not.

**A `+` in the count changes what it counts from.** `tail -n 5` means the last five lines;
`tail -n +5` means from line 5 to the end. It is the one flag people reliably get backwards, and
`tail -n +2` is the standard way to drop a header row before feeding a file to something else.
`-c +N` does the same by byte offset, counting from 1 rather than 0.

**`-f` does not exit.** Instead of stopping at the current end of the file, `tail -f` blocks and
prints new lines as they are appended, which is the usual way to
[watch a log in real time](/recipes/monitor-a-log-in-real-time/). `-n0 -f` skips the existing
content and shows only what arrives from now on. Since the process never ends on its own, `--pid`
exists to make it stop when some other process does.

Following has one failure that is worth understanding before you rely on it. `tail -f` follows the
**file it opened**, identified by its inode, not the name. When `logrotate` renames `app.log` to
`app.log.1` and creates a fresh `app.log`, `-f` carries on watching the renamed file, which nothing
is writing to any more. It does not error, and it does not exit; it simply goes quiet, and the
quiet looks exactly like a service that has stopped logging. `-F` is shorthand for
`--follow=name --retry`, which watches the *name*, notices that the file behind it has been
replaced, and says so before continuing with the new one. For anything under `logrotate`, which on
Debian is most of `/var/log`, `-F` is the flag you want.
