---
title: "kill"
tagline: "Send a signal to a process by id or by name"
description: "Tested kill, pkill and killall examples: choosing a signal, why -9 is a last resort, matching by name or command line, and signalling a whole process group."
category: commands
tags: [processes, sysadmin]
updated: 2026-08-29
related: [ps, processes-and-signals, kill-whatever-is-using-a-port, systemctl]
tier: standard
---

`kill` sends a signal to a process. It usually ends one because the default signal is `TERM`,
which asks a program to shut down and most programs agree to. The same command sends `STOP`,
`CONT` and `HUP`, none of which ends anything.
[Processes and signals](/concepts/processes-and-signals/) covers what the signals mean and what a
program is allowed to do about each of them.

## Naming the target

`kill` takes process ids and nothing else, so `kill firefox` is an error rather than a search.
Three commands close that gap and they select differently.

`pkill` treats its pattern as an extended regular expression and matches it against the process
name, or against the whole command line under `-f`. `killall` matches a name exactly unless you
give it `-r`. `pgrep` is `pkill` with no signal attached: the same selection, printed instead of
acted on.

Run the `pgrep` before the `pkill`. A pattern that turns out to match four processes rather than
one is a great deal cheaper to discover that way.

In an interactive shell `kill` also takes a job spec, so `kill %1` signals the first thing you
backgrounded. [Job control](/commands/job-control/) covers those, and they are the one form that
reaches a whole pipeline rather than a single process.

## Why -9 is a last resort

`kill -9` sends `SIGKILL`, and the kernel removes the process without delivering anything to it.
Nothing runs on the way out: no flush, no lock file removed, no child signalled. A database that
was mid-write is a database that stays mid-write.

`TERM` first, then. `-9` is for the program that has already been asked and has not gone, which
in practice means one that installed a handler and ignores or mishandles the request.

A process stuck in uninterruptible sleep is the case where `-9` looks broken. It is waiting on a
kernel call that cannot be interrupted, usually storage or a hung network mount, and the signal
sits pending until that call returns. The `ps` state column shows `D` for it, and nothing you
send will change the situation.

## Two kills and two packages

`kill` is a bash builtin, and `/usr/bin/kill` from `procps` is a separate program with different
options and different error messages. At a prompt you get the builtin. In a script run through
`sh`, or under `sudo`, or from `find -exec`, you get the binary.

`pkill` and `pgrep` come from `procps`, which Debian marks `important`; `killall` comes from
`psmisc`, which is `optional`. A container or a `debootstrap` install can easily have the first
pair and not the second.
