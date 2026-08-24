---
title: "ps"
tagline: "Show a snapshot of running processes"
description: "Tested ps examples: aux versus -ef, choosing columns with -o, selecting by user or name, sorting, the process tree, and pgrep instead of grep."
category: commands
tags: [processes, sysadmin, monitoring]
updated: 2026-08-24
tier: standard
related: [systemctl, journalctl, kill-whatever-is-using-a-port, xargs]
---

`ps` prints the process table as it stood at the moment the command ran. Nothing about it
updates, and a process that started and exited a second earlier leaves no trace in it.

## Three option syntaxes

Most of the confusion around `ps` comes from it accepting three separate option styles. BSD
options take no dash (`ps aux`), UNIX options take one (`ps -ef`), and GNU long options take two
(`ps --sort=-%mem`).

The same letter can mean different things across them. `u` in BSD syntax asks for the
user-oriented column set, while `-u` in UNIX syntax takes a username and selects that person's
processes. `ps aux` and `ps -u alice` are both correct and have almost nothing to do with each
other.

`ps aux` and `ps -ef` are the two listings people tend to use most often, and both show every
process. They differ in the columns they output: `aux` prints `%CPU`, `%MEM` and the start time,
`-ef` the parent PID.

## What bare ps selects

`ps` on its own shows processes that both belong to you and are attached to your terminal, which
at a prompt means your shell and `ps` itself. `-e`, or its synonym `-A`, selects every process
on the system.

## Choosing the columns

`-o` replaces the default column set entirely: `ps -eo pid,user,comm`. A trailing `=` suppresses
a column's header, so `-o comm=` prints one bare name per line with nothing to strip, which is
handy for feeding `ps` output to [`xargs`](/commands/xargs/).

Two columns are easy to confuse. `comm` is the executable's name, truncated to 15 characters.
`args` is the full command line it was invoked with. A shell script reports its own name under
`comm` and its interpreter plus path under `args`, so a search that works against one may find
nothing against the other.

## What %CPU measures

The `%CPU` column is the process's accumulated CPU time divided by how long it has been alive.
That makes it an average across the whole lifetime rather than a reading of what the process is
doing now: something that saturated a core this morning still reports a high figure tonight.

## Finding a process by name

`ps aux | grep sshd` also matches the `grep`, because `grep sshd` has `sshd` in its own command
line. `pgrep sshd` answers the question directly, never matches itself, and prints PIDs ready for
[killing whatever holds a port](/recipes/kill-whatever-is-using-a-port/).
