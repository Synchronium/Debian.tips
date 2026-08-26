---
title: "Could not get lock /var/lib/dpkg/lock-frontend"
tagline: "apt names the process holding the lock"
description: "apt refuses to run because something else is already installing. Modern apt tells you exactly which process, and deleting the lock file is the wrong fix."
category: troubleshooting
tags: [apt, debian, sysadmin, beginner]
updated: 2026-08-22
related: [apt-essentials, apt-vs-apt-get, release-channels]
---

apt refuses to start while another process is changing packages, and says so:

<!-- verify: skip the pid and the holding process are whatever was running on your machine -->
```
E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 2412 (unattended-upgr)
E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), is another process using it?
```

## Only one thing may change packages at a time

That includes every [`apt`](/commands/apt/) command which installs, removes or upgrades. Before
doing anything, apt takes a lock on `/var/lib/dpkg/lock-frontend`, and if another process is
already holding that lock, apt refuses to start rather than corrupt the package database. The
lock file isn't broken - something else is using it.

The first line of the error names that process, **with its PID**. Older answers were written
when apt only told you that *something* held the lock, which is why so many of them jump
straight to deleting files.

## Who is usually holding it

In order of how often it is the answer:

- **`unattended-upgr`**, Debian's automatic security updates, which run on a timer and can start
  at any moment. This is by far the most common cause on a server, and the most common cause of
  the error appearing seconds after boot.
- **`apt`, `apt-get` or `aptitude`** in another terminal, an `ssh` session you forgot, or a
  `screen`/`tmux` window.
- **`packagekitd`**, a desktop's software updater doing the same job in the background.
- **`dpkg`** running a package's own post-install script, which can take a while for a large
  package.

## Work out which, then wait

The PID is in the message, so use [`ps`](/commands/ps/) to ask about it directly, substituting
the number apt gave you:

```bash
ps -o pid=,comm=,etime= -p 2412
```

`etime` is how long it has been running. An `unattended-upgr` a few seconds old will likely
finish on its own, whereas one that has been running for an hour is probably stuck.

If the process is a legitimate update, **wait.** It will release the lock when it finishes and
your command will work. On a slow connection an unattended upgrade can take several minutes.

To watch rather than guess:

```bash
sudo systemctl status unattended-upgrades.service
```

For anything scripted, modern apt can be told to wait for the lock itself, which is almost
always what you wanted:

```bash
sudo apt-get -o DPkg::Lock::Timeout=120 install <package>
```

That waits up to two minutes for the lock instead of failing immediately, which is what you want
in a provisioning script that intermittently fails on a fresh machine.

## When it really is stale

Sometimes the holder is gone, after a session killed mid-install or a machine that lost power.
You can tell, because the PID in the message doesn't belong to anything:

```bash
ps -p 999999 || echo "no such process, the lock is stale"
```
```
    PID TTY          TIME CMD
no such process, the lock is stale
```

Only then, and only after confirming no apt process is running at all, is it safe to clear up.
Finish what the interrupted run started before removing any evidence of it.

```bash
sudo dpkg --configure -a
```

Interrupting the process can leave a package in a half-configured - and therefore broken -
state. This is the command to repair it. See [`dpkg`](/commands/dpkg/) for reading the states it
reports. Most stale-lock cases end here, with the lock file never touched.

> [!WARNING]
> `sudo rm /var/lib/dpkg/lock-frontend` is the advice you will find most often and the last
> thing you should try. If a process really is still running, deleting the lock lets a second dpkg run
> against the same database, which is exactly the corruption the lock exists to prevent. Delete
> it only after `ps` has shown you the holder is gone, and run `dpkg --configure -a` afterwards
> either way.

## Reproduce it safely

Worth doing once, so the error stops being alarming. Debian always has Perl, which can take the
same kind of lock apt uses. It has to be an `fcntl` lock; holding the file open with `flock(1)`
takes a different kind and does not reproduce this:

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
originally: apt reports whoever holds it. The `1` in that packed struct is `F_WRLCK` and the `6`
is `F_SETLK`; see [Exit codes and error
handling](/concepts/exit-codes-and-error-handling/) for reading the failure if it does not.

## Avoiding the collision

- In scripts, set `DPkg::Lock::Timeout` as above. Simply checking whether apt is running first
  can introduce a race condition, whereas using a timeout cannot.
- On a machine you provision repeatedly, that timeout belongs in
  `/etc/apt/apt.conf.d/` so every invocation gets it.
- Don't disable `unattended-upgrades` to avoid the collision. It is doing the job you want done;
  see [Debian's release channels](/debian/release-channels/) for what it installs.
