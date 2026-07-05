---
title: "Pipes and redirection"
description: "How | connects commands together, and how >, >>, and < route data to and from files."
category: concepts
tags: [terminal, one-liners, beginner]
updated: 2026-07-05
---

You've typed `ls | grep foo` a hundred times. Here's what's actually happening.

## Everything is a stream

Every process on Linux starts with three open file descriptors: **standard input** (fd 0),
**standard output** (fd 1), and **standard error** (fd 2). By default, stdin reads from your
keyboard and stdout/stderr write to your terminal. Pipes and redirection just rewire those
three streams to point somewhere else.

## The pipe: `|`

A pipe connects one command's stdout directly to the next command's stdin:

```bash
ls -l | grep ".log"
```

`ls -l` never knows its output is going to `grep` instead of your screen — it just writes to
fd 1 as always. The shell is the one doing the plumbing.

> [!NOTE]
> Piping only connects stdout, not stderr. If a command's error messages seem to vanish into
> the pipe unread, they're actually still going straight to your terminal.

## Redirecting to and from files

```bash
grep "error" app.log > errors.txt   # overwrite errors.txt with stdout
grep "error" app.log >> errors.txt  # append instead of overwrite
sort < names.txt                    # read stdin from a file instead of the keyboard
grep "error" app.log 2> /dev/null   # discard stderr
```

`2>` redirects file descriptor 2 (stderr) specifically. `&>` (bash) redirects both stdout and
stderr to the same place.

## Why this matters

Small, single-purpose commands become powerful once you can chain them. `ps aux | grep nginx`,
`cat access.log | sort | uniq -c | sort -rn` — each of these is a short pipeline of commands
that individually do very little, connected by `|`.
