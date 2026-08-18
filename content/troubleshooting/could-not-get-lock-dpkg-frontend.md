---
title: "Could not get lock /var/lib/dpkg/lock-frontend"
description: "apt refuses to run because something else is already installing. Modern apt tells you exactly which process, and deleting the lock file is the wrong fix."
category: troubleshooting
tags: [apt, debian, sysadmin, beginner]
updated: 2026-08-18
related: [apt-essentials, apt-vs-apt-get, release-channels]
---

You ran an install and got this instead:

```
E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 2412 (unattended-upgr)
E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), is another process using it?
```

## What it means

Only one thing may change installed packages at a time. Before doing anything, apt takes a lock
on `/var/lib/dpkg/lock-frontend`; if another process already holds it, apt refuses to start
rather than corrupt the package database.

This is apt working correctly. The error is not a broken lock file — it is a second apt.

Read the first line again, because it answers the question most advice online skips: **apt names
the process holding the lock, with its PID.** That behaviour is not in the older answers you
will find, which were written when apt only told you that *something* held it, and which is why
so many of them jump straight to deleting files.

## Who is usually holding it

In order of how often it is the answer:

- **`unattended-upgr`** — Debian's automatic security updates, which run on a timer and can start
  at any moment. This is by far the most common cause on a server, and the most common cause of
  the error appearing seconds after boot.
- **`apt`, `apt-get` or `aptitude`** — another terminal, an `ssh` session you forgot, or a
  `screen`/`tmux` window.
- **`packagekitd`** — a desktop's software updater doing the same job in the background.
- **`dpkg`** — a package's own post-install script, which can take a while for a large package.

## Work out which, then wait

The PID is in the message, so ask about it directly — substituting the number apt gave you:

```bash
ps -o pid=,comm=,etime= -p 2412
```

`etime` is how long it has been running, which is the number that tells you whether to wait or
investigate: an `unattended-upgr` a few seconds old is about to finish on its own, and one that
has been running for an hour is stuck.

If the process is a legitimate update, **wait.** It will release the lock when it finishes and
your command will work. On a slow connection an unattended upgrade can take several minutes.

To watch rather than guess:

```bash
sudo systemctl status unattended-upgrades.service
```

For anything scripted, retry rather than race — modern apt can be told to wait for the lock
itself, which is almost always what you wanted:

```bash
sudo apt-get -o DPkg::Lock::Timeout=120 install <package>
```

That waits up to two minutes for the lock instead of failing immediately, and is the correct fix
for a provisioning script that intermittently fails on a fresh machine.

## When it really is stale

Sometimes the holder is gone — a session killed mid-install, a machine that lost power. You can
tell, because the PID in the message belongs to nothing:

```bash
ps -p 999999 || echo "no such process — the lock is stale"
```
```
    PID TTY          TIME CMD
no such process — the lock is stale
```

Only then, and only after confirming no apt process is running at all, is it safe to clear up.
The right order matters: finish what the interrupted run started, rather than removing evidence
of it.

```bash
sudo dpkg --configure -a
```

That completes any package left half-configured by the interrupted process, which is the actual
damage. In most stale-lock cases this is the entire fix, and the lock file never needed touching.

> [!WARNING]
> `sudo rm /var/lib/dpkg/lock-frontend` is the advice you will find most often and the one to
> reach for last. If a process really is still running, deleting the lock lets a second dpkg run
> against the same database, which is exactly the corruption the lock exists to prevent. Delete
> it only after `ps` has shown you the holder is gone, and run `dpkg --configure -a` afterwards
> either way.

## Reproduce it safely

Worth doing once, so the error stops being alarming. Debian always has Perl, which can take the
same kind of lock apt uses — `fcntl`, not `flock`, which is why holding the file open with
`flock(1)` does not reproduce this:

<!-- verify: shape the PID belongs to whichever perl you just started -->
```bash
perl -e 'open my $fh, "+>>", $ARGV[0] or die $!;
         my $lock = pack "s s l! l! i", 1, 0, 0, 0, 0;
         fcntl $fh, 6, $lock or die "lock: $!";
         sleep 3' /var/lib/dpkg/lock-frontend &
sleep 0.5
sudo apt-get install -y hello 2>&1 | head -2
```
```
E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 42 (perl)
E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), is another process using it?
```

The PID and the name in your output will be Perl's rather than the `unattended-upgr` you saw
originally, which is the point: apt reports whoever actually holds it. The `1` in that packed
struct is `F_WRLCK` and the `6` is `F_SETLK`; see [Exit codes and error
handling](/concepts/exit-codes-and-error-handling/) for reading the failure if it does not.

## Avoiding it

- In scripts, set `DPkg::Lock::Timeout` as above rather than checking whether apt is running
  first — the check-then-act has a race in it, the timeout does not.
- On a machine you provision repeatedly, that timeout belongs in
  `/etc/apt/apt.conf.d/` so every invocation gets it.
- Don't disable `unattended-upgrades` to avoid the collision. It is doing the job you want done;
  see [Debian's release channels](/debian/release-channels/) for what it is actually installing.
