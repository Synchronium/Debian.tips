---
title: "top"
tagline: "Which processes are using the machine right now"
description: "Tested top examples: the summary lines, the process columns, sorting and filtering in batch mode, threads, and reading a process's memory and CPU."
category: commands
tags: [processes, monitoring, performance, sysadmin]
updated: 2026-09-30
tier: standard
related: [ps, free, kill, why-is-this-process-using-so-much-cpu, why-is-this-process-using-so-much-memory, processes-and-signals]
---

`top` redraws a table of processes every few seconds, busiest first, under five summary lines about
the machine as a whole. Run with no arguments it takes over the terminal until you press `q`.

Most of what people do in it is a single key. `P` sorts by CPU and `M` by memory, `1` splits the
CPU line into one line per core, `H` shows threads instead of processes, `c` shows each process's
full command line, `u` asks for a user to filter on, `k` asks for a process ID and a signal and
sends it, `r` renices a process, and `W` saves the current layout to `~/.config/procps/toprc` so
the next `top` starts the same way. A key is not something a page can replay, so the examples here
use the flag that does the same job.

Every example runs in batch mode, `-b`, which prints plain text and exits after the number of
updates `-n` asks for. It is also how `top` is used from a script or a [cron](/commands/crontab/)
job, where there is no terminal to draw on. [`ps`](/commands/ps/) prints the same process
information once, and is easier to parse. `top` is the one to reach for when the question is what
is happening over the next few seconds.

The summary lines describe the machine: its uptime and load, how its CPUs are spending their time,
and the memory and swap figures [`free`](/commands/free/) also prints. Inside a container those
belong to the host, so they differ between any two runs. The task count and the process list below
it belong to whatever ran the command, and the examples that read the list start three processes
of their own, so their names, owners and states are the same every time.
