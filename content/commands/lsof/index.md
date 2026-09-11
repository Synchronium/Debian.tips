---
title: "lsof"
tagline: "List open files and the processes holding them"
description: "Tested lsof examples: what has a file open, which process holds a port, finding a deleted file that is still using disk space, and narrowing the output."
category: commands
tags: [processes, files, disk, networking, sysadmin]
updated: 2026-09-11
tier: flagship
related: [fuser, ps, kill, ss, df, du]
---

`lsof` lists open files. That word covers more than it sounds like: a regular file, a directory, a
device, a pipe, a network socket and the program's own executable are all open files, and `lsof`
reports on every kind in one table. It answers "what is holding this" about a file you cannot
unmount over, a port you cannot bind, and space that will not come back.

The whole table is almost never what you want. With no arguments it prints every open file belonging
to every process, which on an idle Debian server is already thousands of lines, most of them shared
libraries. A useful invocation narrows: to one path, one process name, one user, one port.

Narrowing has a trap in it. `-c`, `-u`, `-p`, `-i` and `-d` combine with OR, so
`lsof -c nginx -u www-data` lists everything nginx has open *plus* everything `www-data` has open.
`-a` switches the combination to AND, and nothing makes it the default. A command that reads as two
conditions is answering a looser question until the `-a` is in it.

The `FD` column carries most of the detail. A number is a file descriptor, followed by the mode the
file was opened in: `3w` is descriptor 3 open for writing, `3r` for reading, `3u` for both. Four
names appear in place of a number. `cwd` is the process's working directory, `rtd` its root, `txt`
the executable it is running, and `mem` a file mapped into its address space, which for anything
dynamically linked means a dozen shared libraries. `-d ^mem` drops those, and it is worth typing
before reading anything.

A file that has been unlinked while a process still holds it open is the case nothing else will show
you. The name is gone from its directory, so [ls](/commands/ls/) cannot see it and
[du](/commands/du/) does not count it, while the blocks stay allocated until the last descriptor
closes. [df](/commands/df/) goes on reporting them as used, which is why a filesystem can stay full
after the large file has been deleted, and why restarting the process frees the space when deleting
the file did not. `lsof +L1` lists the files in that state and nothing else.

`-i` selects network files. `lsof -i :8080` names the process listening on that port and anything
connected to it, which is the same ground [ss](/commands/ss/) covers from the socket's side rather
than the process's. Addresses and ports are resolved to names by default, so 8080 prints as
`http-alt` and `127.0.0.1` as `localhost`; `-P` and `-n` turn off the port and address lookups, and
a `-i` with both is easier to read as well as faster.

What `lsof` can see depends on who runs it. Open files are read through `/proc`, where an ordinary
account may read only its own processes, so the same command without `sudo` gives a shorter answer
rather than an error. That is worth knowing before concluding that nothing holds a file.

Debian ships `lsof` in a package of its own, so a minimal install may not have it.
[fuser](/commands/fuser/) comes from `psmisc` and answers a narrower version of the same question in
a form that is easier to pipe into a `kill`.
