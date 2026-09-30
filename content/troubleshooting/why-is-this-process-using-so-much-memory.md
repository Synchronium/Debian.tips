---
title: "Why is this process using so much memory?"
tagline: "Is memory short, which figure to trust, what to do"
description: "A process looks huge in top, or free shows almost nothing free. Check whether memory is really short, which of RSS, VSZ and PSS to believe, and how to limit it."
category: troubleshooting
tags: [processes, performance, monitoring, sysadmin]
updated: 2026-09-30
related: [free, top, ps, why-is-this-process-using-so-much-cpu, processes-and-signals]
---

A process looks enormous in [`top`](/commands/top/), or [`free`](/commands/free/) says almost
nothing is free, or the machine has started swapping. Each of those can be a real shortage, and
each can equally be a figure being read as something it is not. Most of this page is about telling
the two apart, because the fix for a real shortage is wasted on a misread number.

The examples read three processes started for them. `memhog` has written 200 MiB. `mapper` has
mapped 1 GiB and touched none of it. `sharer` wrote 100 MiB and then forked twice, so there are
three processes called `sharer` and one copy of the data.

## Is the machine actually short of memory?

Start with the machine rather than the process, because a process can only be using too much if
something else is going short:

<!-- verify: skip every figure in the table belongs to the host: memory and swap totals, use, cache and availability -->
```bash
free -h
```
```
               total        used        free      shared  buff/cache   available
Mem:           3.8Gi       2.4Gi       459Mi        12Mi       1.2Gi       1.4Gi
Swap:          1.0Gi       618Mi       405Mi
```
<!-- verify: proof -->
```bash
free | awk '/^Mem:/ {print ($2 - $7 == $3) ? "used is total minus available" : "used is not total minus available"}'
```
```
used is total minus available
```

Read `available`, not `free`. Linux fills spare memory with cached file contents and hands it back
the moment a program asks, so `free` is small on any machine that has been up for a while, and
that is memory being used well rather than memory running out. `used` does not include that cache.

A healthy `available` means the process is large but the machine is coping, and there may be
nothing to fix. A low `available` with swap filling up is a real shortage. Carry on down the page
in either case to find out which process is responsible.

## Which process is holding it

`RSS`, the resident set size, is how much of a process is in memory at this moment, in kibibytes:

<!-- verify: shape the process ID and the resident size differ from run to run -->
```bash
ps -eo pid,rss,comm --sort=-rss | head -2
```
```
    PID   RSS COMMAND
     20 212748 memhog
```

`--sort=-rss` puts the largest first. [`top -o %MEM`](/commands/top/) gives the same order, updated
as it changes. `memhog` wrote 200 MiB, which is 204800 KiB, and the rest of the figure is the
Python interpreter holding it. When one process is far ahead of the others, as here, it is the
one to look at. When several are close together, read the next two sections before adding them up.

## A large VSZ means nothing on its own

`VSZ` is the virtual size: everything the process has mapped into its address space, whether it
has used it or not.

<!-- verify: shape the process ID and both sizes differ from run to run -->
```bash
ps -o pid,vsz,rss,comm -C mapper
```
```
    PID    VSZ   RSS COMMAND
     23 1062572 7984 mapper
```
```bash
ps -o vsz=,rss= -C mapper | awk '{print ($1 - $2 > 900 * 1024) ? "mapper has mapped more than 900 MiB it has not touched" : "mapper has touched most of what it mapped"}'
```
```
mapper has mapped more than 900 MiB it has not touched
```

A gigabyte of `VSZ` and 8 MiB of `RSS`. The kernel does not give a process real memory for an
address range until the process writes to it, so mapping costs almost nothing. Java, browsers
and anything with a large thread pool routinely show a `VSZ` many times their `RSS`. A process is
using too much memory when its `RSS` is large, and `VSZ` can be left alone.

## Adding up RSS counts shared memory more than once

<!-- verify: shape the process IDs and the resident sizes differ from run to run -->
```bash
ps -o pid,ppid,rss,comm -C sharer
```
```
    PID    PPID   RSS COMMAND
     26       1 110468 sharer
     42      26 107876 sharer
     43      26 107748 sharer
```

Three processes of about 106 MiB each, which looks like 318 MiB between them, but there is only one
copy of the data. The first wrote its 100 MiB and then forked the other two, and a forked child shares its parent's pages until
one of them writes to a page. All three count the same pages as resident.

`PSS`, the proportional set size, divides each shared page between the processes sharing it, so
the figures can be added up:

<!-- verify: shape the process IDs and both sizes differ from run to run -->
```bash
ps -o pid,rss,pss,comm -C sharer
```
```
    PID   RSS   PSS COMMAND
     26 110020 37452 sharer
     42 107876 35856 sharer
     43 107748 35786 sharer
```
```bash
ps -o rss=,pss= -C sharer | awk '{rss += $1; pss += $2} END {print (rss > 2 * pss) ? "the RSS figures add up to more than twice the PSS figures" : "the RSS figures add up to less than twice the PSS figures"}'
```
```
the RSS figures add up to more than twice the PSS figures
```

About 107 MiB of `PSS` in total, against about 318 MiB of `RSS`. This matters whenever a service
runs as a pool of worker processes forked from one parent, as Apache, PostgreSQL, Gunicorn and
PHP-FPM all do: adding up their `RSS` in `top` can come to more memory than the machine has. `top`
has a `PSS` column too, turned on with `f` in the running display.

Read `PSS` as root. Working it out means reading the process's memory map, which the kernel allows
only for your own processes, and for anyone else's `ps` prints `0` rather than an error.

## Is it still growing?

A process that is large is not the same problem as one that keeps getting larger. A leak shows as
`RSS` rising between samples taken a while apart. The first line here starts a process that adds
10 MiB every fifth of a second, to have something to sample:

```bash
python3 -c '
import time
chunks = []
while True:
    chunks.append(b"x" * (10 * 1024 * 1024))
    time.sleep(0.2)
' &
pid=$!
sleep 1; before=$(ps -o rss= -p "$pid")
sleep 1; after=$(ps -o rss= -p "$pid")
kill "$pid"; wait "$pid"
[ "$after" -gt "$before" ] && echo "RSS grew between the two samples"
```
```
RSS grew between the two samples
```

For a real process, sample a minute or an hour apart rather than a second, since a program's
memory rises and falls in the normal course of its work. `ps -o rss= -p PID` in a loop, or
`top -b -d 60 -p PID` left running into a file, gives a series to look at. A figure that falls back
after each busy period is a cache. One that only ever rises is a leak, and the fix is in the program,
or a restart until the program is fixed.

## Putting a ceiling on it

A limit makes the one process fail rather than the machine. `ulimit -v` limits the address space of
a shell and everything it starts, in kibibytes, and an allocation past it fails inside the program:

```bash
(ulimit -v 102400; python3 -c 'data = b"x" * (200 * 1024 * 1024)') 2>&1 | tail -1
```
```
MemoryError
```

The parentheses keep the limit to a subshell, so the shell it was typed into is not limited
afterwards. `ulimit -v` limits `VSZ` rather than `RSS`, so a program that maps far more
than it uses, as `mapper` does, can fail under a limit it never came near in real memory.

For a service, the limit belongs in its unit, where systemd enforces it on real memory for the
service and every process it starts:

```ini
[Service]
MemoryHigh=400M
MemoryMax=500M
```

`MemoryHigh` slows the service down and makes it give memory back once it passes the figure.
`MemoryMax` is the hard limit, and a service that reaches it has a process killed. Put both in a
drop-in with `systemctl edit servicename`, and see
[managing services with systemd](/debian/systemd-services/) for the rest.

## When the kernel steps in

With no limit set and memory and swap both exhausted, the kernel's out-of-memory killer picks a
process and kills it with `SIGKILL`, usually the one using the most memory, which is not always the
one that caused the shortage. The kernel log records every one:

```bash
journalctl -k | grep -i "out of memory"
```

A process that disappeared with no error of its own, and a service whose status says it was killed
by signal 9, are both worth checking against that log before looking anywhere else.
[Processes and signals](/concepts/processes-and-signals/) explains why `SIGKILL` leaves the process
no chance to say anything first.
