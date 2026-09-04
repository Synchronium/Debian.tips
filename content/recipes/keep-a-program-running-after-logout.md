---
title: "Keep a program running after you log out"
tagline: "nohup, setsid, tmux, and which one you actually want"
description: "How to stop a long job dying when an ssh session ends, what each approach really does about SIGHUP, and an honest recommendation between them."
category: recipes
tags: [processes, ssh, sysadmin]
updated: 2026-08-29
related: [processes-and-signals, ssh, kill-whatever-is-using-a-port]
---

**Problem:** a long job is running over ssh, the connection drops or the terminal closes, and the
job dies with it.

**Solution:** pick by what you want to do afterwards, not by which command you saw first.

| You want to | Use |
| --- | --- |
| Come back to it, watch it, type at it | `tmux` |
| Fire it off and read a log later | `nohup cmd > log 2>&1 &` |
| Have it restart on failure, survive a reboot, log to the journal | `systemd-run --user` |
| Rescue something already running | [`disown -h %1`](/commands/job-control/) |

`tmux` is the answer most of the time, and it is not installed on a base Debian system
(`sudo apt install tmux`). Nothing else in this list lets you reattach and see what the program
is doing now.

**How `nohup` works:**

The one-off case, where the job writes to a log and you read it afterwards:

```bash
cat > worker.sh <<'EOF'
#!/usr/bin/env bash
for i in 1 2 3; do echo "tick $i"; sleep 1; done
EOF
chmod +x worker.sh

nohup ./worker.sh > worker.log 2>&1 &
disown -a
sleep 4
cat worker.log
```
```
tick 1
tick 2
tick 3
```

- `> worker.log 2>&1` is not optional in practice. Without a redirection `nohup` sends output to
  `nohup.out` in the current directory, but only when stdout is a terminal; anywhere else it
  leaves the streams alone and the output goes wherever the parent's did.
- `&` puts it in the background. Without it the command holds the terminal you were hoping to
  walk away from, even though the `SIGHUP` protection is the same either way.
- `disown -a` drops the jobs from the shell's table, so the shell will not send them `SIGHUP`
  itself and will not print a line about each one as it exits.

`nohup` sets `SIGHUP` to ignored before starting the program, and an ignored signal stays ignored
across the `exec`. Send one by hand to two otherwise identical jobs:

```bash
sleep 10 > /dev/null 2>&1 &
plain=$!
nohup sleep 10 > /dev/null 2>&1 &
guarded=$!
disown -a
sleep 1

kill -HUP "$plain" "$guarded"
sleep 1

kill -0 "$plain"   2>/dev/null && echo "plain job:   still running" || echo "plain job:   gone"
kill -0 "$guarded" 2>/dev/null && echo "under nohup: still running" || echo "under nohup: gone"

kill "$guarded" 2>/dev/null
```
```
plain job:   gone
under nohup: still running
```

**Variations:**

`setsid cmd > log 2>&1 &` puts the program in a session of its own with no controlling terminal.
It does not ignore `SIGHUP`; it arranges never to be sent one by a terminal, since it no longer
has one. A `kill -HUP` you send by hand still ends it, where the same signal to a `nohup` job
does nothing at all.

`disown -h %1` is the rescue: the job is already running, you did not think ahead, and this marks
it so the shell will not send `SIGHUP` on exit. Its output still goes to the terminal that is
about to disappear, so anything printed after you log out is lost.

`systemd-run --user --unit=backup ./worker.sh` hands the job to systemd instead of to your shell.
It gets a unit name, its output goes to the journal (`journalctl --user -u backup`), and it can
be given `Restart=` and a timer. This is the right answer for anything that should still be
running next week, and it needs lingering enabled (`loginctl enable-linger`) if it has to survive
you logging out entirely.

Why any of this is necessary, and what `SIGHUP` has to do with a closed terminal, is
[Processes and signals](/concepts/processes-and-signals/): the terminal sends the signal to a
whole process group, which is why `&` alone saves nothing.
