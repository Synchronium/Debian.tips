---
title: "Time how long something takes"
tagline: "Three numbers, and two different commands called time"
description: "What real, user and sys actually measure, why the time you type is not /usr/bin/time, and how to capture a timing into a file instead of the terminal."
category: recipes
tags: [performance, scripting, terminal]
updated: 2026-09-06
related: [processes-and-signals, exit-codes-and-error-handling, monitor-a-log-in-real-time]
---

**Problem:** You want to know how long a command took, and the answer comes back as three numbers
you did not ask for.

**Solution:**

<!-- verify: shape the three figures are what your machine took, so all of them will differ -->
```bash
time sleep 0.2
```
```

real	0m0.204s
user	0m0.001s
sys	0m0.002s
```

**How it works:**

The three numbers measure different things, and the gaps between them are where the information
is.

**`real`** is wall-clock time: what a stopwatch would have said. It includes time the command spent
waiting on a disk, a network or another process, and time the machine spent on something else
entirely.

**`user`** is CPU time spent running the command's own code.

**`sys`** is CPU time spent inside the kernel on the command's behalf, reading files and allocating
memory.

`sleep` is the clearest case: two tenths of a second of `real` and almost no CPU at all, because it
did nothing but wait. The reverse pattern, `user` close to `real`, is a command that was busy the
whole time. And `user` plus `sys` *exceeding* `real` is not a mistake: it means the work ran on
several cores at once.

**Variations:**

The `time` you type is not a program. It is part of the shell's grammar, which is why it can time a
whole pipeline:

```bash
type time
command -v time
```
```
time is a shell keyword
time
```

Debian ships a separate `/usr/bin/time` in the `time` package, which is not installed by default.
It reports the same measurements differently and knows things the keyword does not:

<!-- verify: shape every figure is specific to the run and the machine -->
```bash
/usr/bin/time sleep 0.2
```
```
0.00user 0.00system 0:00.20elapsed 0%CPU (0avgtext+0avgdata 1288maxresident)k
0inputs+0outputs (0major+85minor)pagefaults 0swaps
```

`maxresident` is the peak memory the command used, in kilobytes, and it is the reason to reach for
the program rather than the keyword. `-f` chooses what to print:

<!-- verify: shape both figures are specific to the run -->
```bash
/usr/bin/time -f 'elapsed %es, max RSS %MkB' sleep 0.2
```
```
elapsed 0.20s, max RSS 1352kB
```

`%e` is elapsed seconds, `%M` peak resident memory, `%P` the CPU percentage, and `-v` prints
everything it knows in a long block, including page faults and context switches.

> [!WARNING]
> `time cmd > out.log` does not put the timing in the file. The keyword writes to the shell's
> standard error, not the command's, so the redirect applies to `cmd` alone.

Group the whole thing to capture it:

<!-- verify: shape the three figures are specific to the run -->
```bash
{ time sleep 0.2 ; } 2> timing.log
cat timing.log
```
```

real	0m0.201s
user	0m0.000s
sys	0m0.002s
```

The braces make one compound command whose standard error the redirect can reach. `/usr/bin/time`
needs none of this, since `-o file` is one of its options.

For anything that finishes quickly, a single run tells you very little: process startup, a cold
cache and whatever else the machine was doing swamp the measurement. Run it enough times to see the
spread before believing a difference, and compare `user` rather than `real` when the machine is
busy, since `real` is measuring the machine's load as much as your command.
