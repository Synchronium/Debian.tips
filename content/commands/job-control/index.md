---
title: "job control"
tagline: "Suspend, resume and detach what you started"
description: "Tested jobs, fg, bg, disown and nohup examples: the jobs table, job specs like %1, suspending and resuming, and why none of it works in a script."
category: commands
tags: [processes, terminal, sysadmin]
updated: 2026-08-29
related: [ps, kill, processes-and-signals, keep-a-program-running-after-logout]
tier: standard
---

A job is one thing your shell started, and it is not the same unit as a process: a pipeline of
four commands is four processes and one job. `jobs`, `fg`, `bg` and `disown` are shell builtins
that work on that list, so they only ever know about commands this shell started. Another
terminal's background job is invisible to them, and only [`ps`](/commands/ps/) sees across the
whole machine.

## The numbers in brackets are not PIDs

`[1]` is a job number, counted per shell and reused as jobs finish. Anywhere a command takes a
job, `%1` names it, `%+` is the current job and `%-` the previous one, and `%str` matches a job
whose command begins with `str`. The `+` and `-` in the `jobs` output mark those last two.

[`kill`](/commands/kill/) accepts a job spec as well as a PID, so `kill %1` and `kill 4749` can be
the same instruction. `$!` holds the PID of the job you started most recently. Save it
into a variable if you want to signal that job later.

## None of this works in a script

Job control is a feature of an interactive shell, and bash switches it off everywhere else. A
script that calls `fg` gets `no job control` and stops; `%1` is not understood; Ctrl-Z has no
meaning where there is no terminal to send it. `set -m` turns it back on, and is occasionally the
right answer, but a script that wants to manage several children usually wants `$!` and `wait`
instead.

The examples below use `set -m` wherever a job has to be suspended, because otherwise the shell
never notices it happened.

## Ctrl-Z, and what comes after it

Ctrl-Z suspends the foreground job by sending it `TSTP`. The process stops where it is, keeping
its memory and its open files, and does nothing until something resumes it. `fg` resumes it in the
foreground, `bg` resumes it in the background, and both send `CONT` to do so.

The usual reason to want it is that you started something long without an `&` and would like your
prompt back. Ctrl-Z, then `bg`, then `disown` if you also intend to close the terminal.
[Keeping a program running after you log out](/recipes/keep-a-program-running-after-logout/) has
the case where that is not good enough.
