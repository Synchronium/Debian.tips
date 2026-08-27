---
title: "Processes and signals"
tagline: "What is running, and how to ask it to stop"
description: "How processes are born, orphaned and reaped, what a signal actually does, why kill -9 is a last resort, and why Ctrl-C stops a whole pipeline at once."
category: concepts
tags: [processes, terminal, sysadmin, scripting]
updated: 2026-08-27
related: [ps, exit-codes-and-error-handling, systemctl, kill-whatever-is-using-a-port]
---

A process is a running program, and the kernel keeps a small amount of bookkeeping about each
one: a number, a parent, an owner, a working directory, an environment, and a table of open
files. Signals are the only way to interrupt one from outside. Ctrl-C, `kill` and a service
shutting down cleanly are all the same mechanism.

## Every process has a parent

A process is created by an existing process cloning itself and then replacing its own program
with a new one. Every process therefore has a parent, and the whole system is a tree with one
process at the root:

```bash
ps -p 1 -o pid,comm
```
```
    PID COMMAND
      1 systemd
```

Your shell's parent is whatever started it, and its children are the commands you run.
`ps -o ppid` prints the parent of anything. [`ps`](/commands/ps/) covers reading the tree in more
detail.

The tree is not allowed to have holes in it. When a parent exits while its children are still
running, those children are handed to PID 1 rather than being killed:

```bash
bash -c 'sleep 300 >/dev/null 2>&1 & exit'
sleep 0.4
ps -o comm,ppid -C sleep | grep -w 1
```
```
sleep                 1
```

The inner shell exited immediately and `sleep` is now a child of `systemd`. Reparenting is how a
background job outlives the shell that started it. Closing a terminal does not necessarily stop
what you launched from it.

## A dead process is not gone until someone collects it

The opposite case is a child that exits while its parent is still running. Its memory and open
files are released straight away. The kernel keeps the exit status, because the parent is
entitled to read it, and until the parent does the entry stays in the process table in state `Z`,
for zombie.

```bash
perl -e 'fork or exit 0; sleep 300' & disown
sleep 0.5
zpid=$(ps -eo pid=,stat= | awk '$2 ~ /^Z/ {print $1; exit}')
ps -o stat,comm -p $zpid
kill -KILL $zpid; sleep 0.3
ps -o stat,comm -p $zpid
pkill -x perl; sleep 0.5
ps -o stat,comm -p $zpid >/dev/null 2>&1 || echo 'gone, once its parent exited'
```
```
STAT COMMAND
Z    perl
STAT COMMAND
Z    perl
gone, once its parent exited
```

Note the middle pair of lines. `kill -KILL` on a zombie changes nothing, because there is nothing
left to kill. Signals act on a running process. This one has already run to completion, and what
remains of it is a record waiting to be read.

A pile of zombies is a bug in the parent, which is failing to collect its children. Kill the
parent and they are reparented to PID 1, which collects them at once. A handful of them are
harmless and take no memory.

## Signals are numbers with names

```bash
kill -l | head -3
```
```
 1) SIGHUP	 2) SIGINT	 3) SIGQUIT	 4) SIGILL	 5) SIGTRAP
 6) SIGABRT	 7) SIGBUS	 8) SIGFPE	 9) SIGKILL	10) SIGUSR1
11) SIGSEGV	12) SIGUSR2	13) SIGPIPE	14) SIGALRM	15) SIGTERM
```

`kill` sends one. The name oversells it. `kill` is a general "send a signal" command, and killing
is only the default behaviour, because the default signal is TERM and the default action for TERM
is to terminate.

A process can install a **handler** for most signals, which runs instead of the default action.
It can also ignore a signal outright. The six you will actually use:

| Signal | Number | Sent by | What it is for |
| --- | --- | --- | --- |
| `HUP` | 1 | closing a terminal | the session is ending; also "reload your config" by convention |
| `INT` | 2 | Ctrl-C | interrupt, politely |
| `QUIT` | 3 | Ctrl-\ | interrupt, and dump core |
| `KILL` | 9 | you, as a last resort | cannot be caught or ignored |
| `TERM` | 15 | `kill` with no argument | please shut down |
| `STOP` | 19 | you, or Ctrl-Z as `TSTP` | suspend; cannot be caught either |

## TERM lets a process clean up

A process that receives TERM decides for itself what happens next. A well-written one uses the
opportunity to tidy up. This script removes its lock file on the way out:

```bash
./polite.sh & pid=$!; disown $pid
sleep 0.4
ls polite.lock
kill -TERM $pid
sleep 0.4
ls polite.lock
```
```
polite.lock
polite: caught SIGTERM, cleaning up
ls: cannot access 'polite.lock': No such file or directory
```

The same script under `kill -KILL` never gets the chance:

```bash
./polite.sh & pid=$!; disown $pid
sleep 0.4
kill -KILL $pid
sleep 0.4
ls polite.lock
```
```
polite.lock
```

The lock file is still there. On a real service the leftovers are worse: half-written output, a
database that will replay its journal on the next start, children nobody told to stop. Send TERM,
give it a few seconds, and escalate only if nothing happens.

## What KILL is for

Some processes decline to act on TERM. Others are too broken to run their own handler. KILL
exists for both:

```bash
./stubborn.sh & pid=$!; disown $pid
sleep 0.4
kill -TERM $pid
sleep 0.4
kill -0 $pid && echo 'stubborn: still running'
kill -KILL $pid
sleep 0.4
kill -0 $pid 2>/dev/null || echo 'stubborn: gone'
```
```
stubborn: caught SIGTERM, ignoring it
stubborn: still running
stubborn: gone
```

KILL is never delivered to the process at all. The kernel removes it. No handler runs, and no
program can refuse. One situation still defeats it.

**If `kill -9` appears to do nothing, the process is almost certainly in state `D`**, an
uninterruptible sleep. A process enters it while waiting on the kernel for something it cannot be
interrupted out of. In practice that means disk or network I/O: a hung NFS mount, a failing
drive, a device that stopped answering. The signal is recorded and delivered the moment the wait
ends, so the process dies as soon as the I/O completes or the mount comes back. Nothing will
speed that up. Check for it with `ps -o stat` rather than guessing.

## Signals and exit status

When a signal terminates a process, the shell reports it as **128 plus the signal number**:

```bash
bash -c 'kill -TERM $$'; echo "TERM: $?"
bash -c 'kill -INT $$'; echo "INT: $?"
bash -c 'exit 0'; echo "clean: $?"
```
```
Terminated
TERM: 143
INT: 130
clean: 0
```

143 is 128+15 and 130 is 128+2. A script interrupted with Ctrl-C therefore shows up as 130 in a
log. See [exit codes](/concepts/exit-codes-and-error-handling/) for the rest of the range.

## A signal goes to a group, not a process

Processes are collected into **process groups**. Give `kill` a negative number and the signal
goes to a whole group at once. The shell puts each pipeline it starts into a group of its own,
so a pipeline can be handled as one thing:

```bash
set -m
sleep 300 | cat & pid=$!
sleep 0.3
echo "before: $(pgrep -c -f '^sleep 300$')"
kill -TERM -$(ps -o pgid= -p $pid | tr -d ' ')
sleep 0.3
echo "after:  $(pgrep -c -f '^sleep 300$')"
```
```
before: 1
after:  0
```

One signal, two processes gone. `set -m` is there because putting each job in its own group is
part of job control, which an interactive shell has switched on and a script does not.

**Ctrl-C is built on this, and the shell has nothing to do with it.** The terminal driver watches
for a few particular keystrokes and turns them into signals aimed at whichever process group is
currently in the foreground. Ctrl-C sends INT, Ctrl-\ sends QUIT, Ctrl-Z sends TSTP. So Ctrl-C
stops every stage of a pipeline rather than only the one printing to your screen, and does
nothing at all to a background job, which is not in the foreground group.
[Terminal, shell and tty](/concepts/terminal-shell-and-tty/) has the rest of what that driver
does, including the keystrokes that send no signal at all.

TSTP suspends rather than terminates. STOP does the same and cannot be trapped. A suspended
process sits in state `T`, holding its memory and open files, until something sends it CONT:

```bash
sleep 300 & pid=$!; disown $pid
sleep 0.3
kill -STOP $pid; sleep 0.2; ps -o stat,comm -p $pid
kill -CONT $pid; sleep 0.2; ps -o stat,comm -p $pid
kill -KILL $pid
```
```
STAT COMMAND
T    sleep
STAT COMMAND
S    sleep
```

`fg` and `bg` send CONT, and keep track of which group the terminal should be listening to.

## Closing the terminal sends HUP

When a terminal goes away the kernel sends HUP to the foreground process group, and the shell
passes it on to its jobs. HUP terminates by default. A long job started with `&` and left
running usually dies with the connection that started it. The name is a fossil from when it
meant the modem had hung up.

Three commands get round this, by three different mechanisms:

- **`nohup command &`** starts the process with HUP already set to ignore. The signal arrives and
  has no effect. Output goes to `nohup.out` unless you redirect it.
- **`command & disown`** leaves HUP alone and removes the job from the shell's table, so the
  shell does not send it one. The kernel can still deliver HUP directly if the terminal
  disappears, which `disown -h` covers by marking the job to be skipped.
- **`setsid command`** puts the process in a new session with no controlling terminal at all.
  There is nothing to hang up, so the question does not arise.

None of the three is the right answer for anything you actually care about. A job that must
survive a disconnection belongs in `tmux`, or in a systemd unit, where it also gets restarts and
logs. [systemd services](/debian/systemd-services/) makes that case for Debian.

Daemons tend to use HUP for something else entirely. A background daemon has no terminal to be
hung up on, leaving the signal going spare, so by convention it re-reads its configuration
instead. `kill -HUP` is the traditional way to reload nginx or sshd, and
[`systemctl reload`](/commands/systemctl/) usually does exactly that underneath.
