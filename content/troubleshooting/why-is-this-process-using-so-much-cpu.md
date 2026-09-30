---
title: "Why is this process using so much CPU?"
tagline: "Which process, which kind of work, where it came from"
description: "The machine is slow and one process is at the top of top. Find it, check whether the figure means what it seems to, see what it is doing, and make it give way."
category: troubleshooting
tags: [processes, performance, monitoring, sysadmin]
updated: 2026-09-30
related: [top, ps, kill, why-is-this-process-using-so-much-memory, processes-and-signals]
---

The machine is slow, the fans are loud, or a job that normally takes a minute has taken an hour.
Something is using the CPU, and there are five things to find out:

- which process it is
- whether its CPU figure means what it appears to
- what kind of work it is doing
- where it came from
- how to make it give way

The examples read four processes started for them. `spinner` is stuck in an empty loop, started by
a script called `nightly-report`. `cruncher` is compressing an endless stream on several threads.
`ddcaller` is copying one byte at a time. `indexer` worked flat out for two seconds when it started
and has been asleep ever since.

## Is the machine short of CPU at all?

<!-- verify: skip the load average belongs to the host, and so does the number of CPUs it is read against -->
```bash
uptime; nproc
```
```
 15:37:37 up 4 days, 23:07,  0 users,  load average: 0.63, 0.97, 1.12
8
```

The three load averages are over the last one, five and fifteen minutes. Each is roughly the
number of processes that were running or waiting to run, averaged over that time, so it is read
against the number of CPUs `nproc` prints. A load below the CPU count means every process that
wanted a CPU got one. A load well above it means processes are queueing, and the machine feels
slow even when no single process is to blame.

On Linux the load also counts processes waiting on a disk in state `D`, which use no CPU at all.
A high load with idle CPUs is a disk or a network filesystem that is slow to respond, and the rest
of this page will not help with it.

## Which process is it?

[`top`](/commands/top/) sorts by current CPU use, busiest first. Two updates half a second apart,
and the name and `%CPU` of the first row of the second one:

<!-- verify: shape the CPU share differs from run to run -->
```bash
top -b -n2 -d 0.5 -o %CPU | awk '/^ *PID/ {n++; next} n == 2 {print $12, $9; exit}'
```
```
cruncher 342.0
```

The second update matters. `top` works `%CPU` out from how much CPU time a process used since the
previous update, and the first update has barely any interval to measure. In the running display
this is simply the top of the list.

## Is ps telling you the same thing?

[`ps`](/commands/ps/) has a `%CPU` column too, but it tells you something different:

<!-- verify: shape the process ID, the CPU share and the running time differ from run to run -->
```bash
ps -o pid,pcpu,etime,comm -C indexer
```
```
    PID %CPU     ELAPSED COMMAND
     36 18.8       00:10 indexer
```
```bash
[ "$(ps -o pcpu= -C indexer | tr -d ' ')" != 0.0 ] && top -b -n2 -d 0.5 -p "$(pgrep -x indexer)" | tail -1 | awk '{print ($9 == 0.0) ? "ps shows CPU used in the past, top shows none used now" : "top shows CPU used now"}'
```
```
ps shows CPU used in the past, top shows none used now
```

`ps` divides all the CPU time a process has ever used by how long it has existed. `indexer` has
been asleep since its first two seconds, and `ps` still gives it a share, one that shrinks the
longer it sleeps. `top` measures between two updates, so it reads zero. A `ps` sorted by `%CPU`
finds whatever has worked hardest on average since it started, which is a long-running daemon more
often than the process that is slowing the machine down now.

## More than 100%

`%CPU` in `top` is a share of one CPU, so a process working on several at once goes past 100:

<!-- verify: shape the CPU share differs from run to run -->
```bash
top -b -n2 -d 0.5 -p "$(pgrep -x cruncher)" | tail -1 | awk '{print $12, $9}'
```
```
cruncher 352.0
```
```bash
top -b -n2 -d 0.5 -H -p "$(pgrep -x cruncher)" | awk '/^ *PID/ {n++; next} n == 2 && $9 > 20 {busy++} END {print (busy > 1) ? "more than one thread of cruncher is busy" : "one thread at most is busy"}'
```
```
more than one thread of cruncher is busy
```

`-H` lists threads rather than processes, and the second command counts the threads using more
than a fifth of a CPU. The row for the process as a whole shows its first thread's state, which for
a program that hands its work to other threads is often `S` while the process is at 350%. A program that is meant to use every core, like a compressor, a compiler or
a database running a big query, is doing its job at 350%. A program stuck at exactly 100% with one
busy thread among many idle ones is more often a loop that has lost its way.

## Its own code, or the kernel's?

The kernel counts a process's CPU time in two parts: time in the program's own code, and time the
kernel spent working on its behalf, reading, writing and waiting on system calls. The two are
fields 14 and 15 of `/proc/PID/stat`, in clock ticks:

<!-- verify: shape the tick counts grow for as long as the processes run -->
```bash
for name in spinner ddcaller; do awk -v name="$name" '{printf "%-9s user %6d  system %6d\n", name, $14, $15}' "/proc/$(pgrep -x "$name")/stat"; done
```
```
spinner   user   1419  system      0
ddcaller  user    400  system   1019
```
```bash
for name in spinner ddcaller; do awk -v name="$name" '{print name ": " (($15 > $14) ? "mostly system time" : "mostly user time")}' "/proc/$(pgrep -x "$name")/stat"; done
```
```
spinner: mostly user time
ddcaller: mostly system time
```

`spinner` never asks the kernel for anything. `ddcaller` makes two system calls for every byte it
copies, so the kernel does most of its work. A process heavy on user time is computing, and the
explanation is in what it was asked to compute. One heavy on system time is doing a great deal of I/O in
small pieces, or calling something far more often than it needs to. The `us` and `sy` figures on
`top`'s CPU line give the same split for the machine as a whole.

## Where did it come from?

A busy process with a generic name says little. What started it usually says more:

```bash
pstree -a -s "$(pgrep -x spinner)"
```
```
sleep infinity
  `-nightly-report /opt/tips/nightly-report
      `-spinner BEGIN { while (1) {} }
```

`-s` prints the process's ancestors and `-a` their arguments, so the chain reads from the first
process on the machine down to the busy one. Here that is a report script, and the fix is in the
script. On a real machine the chain usually starts at `systemd`, and the line under it says
whether the process belongs to a service, a user's session or [cron](/commands/crontab/).
`ps -o pid,ppid,etime,args -p PID` gives the parent's ID and how long the process has been running,
which is worth knowing before killing a job that may be nearly finished.

## Making it give way

A process's nice value, from -20 to 19, decides its share when processes compete for a CPU. Raising
it asks the scheduler to prefer everything else, and any user may raise it on their own processes.
Here two identical loops share one CPU, one of them at nice 19:

```bash
taskset -c 0 gawk 'BEGIN { while (1) {} }' & a=$!
taskset -c 0 nice -n 19 gawk 'BEGIN { while (1) {} }' & b=$!
sleep 0.5
top -b -n2 -d 1 -p "$a,$b" | tail -2 | awk 'NR == 1 {full = $9} NR == 2 {print ($9 < full / 10) ? "the niced process got less than a tenth of what the other did" : "the niced process got a tenth or more"}'
kill "$a" "$b"; wait "$a" "$b"
```
```
the niced process got less than a tenth of what the other did
```

`taskset -c 0` pins both to the first CPU, so they have to compete. A niced process is not slowed
down when nothing else wants the CPU, only when something does, so a machine running a big batch
job at nice 19 stays responsive for everything else. `renice -n 19 -p PID` does the same to a
process that is already running. Lowering the value again, or setting it below zero, needs root.

To stop a process for a while without losing its work, send it `SIGSTOP`, and `SIGCONT` to carry
on:

```bash
gawk 'BEGIN { while (1) {} }' & pid=$!
sleep 0.2; kill -STOP "$pid"; sleep 0.2; ps -o s= -p "$pid"
kill -CONT "$pid"; sleep 0.2; ps -o s= -p "$pid"
kill "$pid"; wait "$pid"
```
```
T
R
```

`T` is stopped, and `R` is running again. The pauses give each signal time to land before `ps`
looks. [`kill`](/commands/kill/) has the rest of the signals, and
[processes and signals](/concepts/processes-and-signals/) what each one does to a process.

For a service, a limit belongs in its unit rather than in a signal. `CPUQuota=50%` holds it to half
of one CPU however much it asks for, and `Nice=10` starts it with a lower priority. Both go in a
drop-in made with `systemctl edit servicename`, which
[managing services with systemd](/debian/systemd-services/) covers.
