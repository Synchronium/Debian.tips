---
title: "Permission denied"
tagline: "Which check refused, and which account it refused"
description: "The message names the path and never the reason. Work out which check failed, which account was refused, and when the mode is not the thing doing the refusing."
category: troubleshooting
tags: [permissions, files, sysadmin]
updated: 2026-09-13
related: [file-permissions-explained, stat, chmod, sudo, find-permission-denied]
---

Almost every one of these is the same errno: `EACCES`, number 13. Every program words it
identically, because they all hand the number to `strerror` and print what comes back:

```bash
cat /srv/tips/secrets.env
```
```
cat: /srv/tips/secrets.env: Permission denied
```

That sentence carries one fact, which is the path. It does not say which of read, write and execute
was refused, which account was refused, or which component of the path the kernel gave up on. Three
questions answer all of it, best asked in order.

## Who you are, and what the file allows

[`stat`](/commands/stat/) prints the mode and both owners without the padding and the date that
make `ls -l` awkward to read, and `id` says who the kernel thinks you are:

```bash
stat -c "%A %U %G %n" /srv/tips/secrets.env
id
```
```
-rw------- root root /srv/tips/secrets.env
uid=1000(user) gid=1000(user) groups=1000(user)
```

Line those two up. The file is owned by `root`, you are `user`, so you fall into the "everyone
else" class, whose three bits are `---`. With both halves on screen the answer stops being a guess,
and this is what most denials turn out to be.
[File permissions explained](/concepts/file-permissions-explained/) has the model behind the nine
bits; what follows is about the cases where lining the two up is not enough.

## Only one class is ever checked

The kernel decides which class you are in first and applies that class alone. Owner beats group,
group beats everyone else, and the classes that did not match are never consulted. So a file can
refuse its own owner while granting a group that owner belongs to:

```bash
cat /srv/tips/draft.txt
stat -c "%A %U %G %n" /srv/tips/draft.txt
id -nG
```
```
cat: /srv/tips/draft.txt: Permission denied
----rw---- user user /srv/tips/draft.txt
user
```

Owner `user`, group `user`, with the account in that group. The group bits say `rw-`, which never
comes into it: the owner matched, the owner's bits are `---`, so that is the answer. A mode like
this usually arrives from a mistyped `chmod` rather than from anyone's intent. It is also the one
denial you are never stuck behind, because changing a mode needs ownership rather than permission:

```bash
chmod u+r /srv/tips/draft.txt
cat /srv/tips/draft.txt
```
```
draft
```

## The refusal that is not about the file

A path is checked one component at a time, and every directory along it needs `x` for you before
the kernel will look at the next name. When one of them refuses, the error still names the file at
the end, which sends people to look at the wrong object:

```bash
cat /srv/tips/private/notes.txt
stat -c "%A %U %n" /srv/tips/private/notes.txt
```
```
cat: /srv/tips/private/notes.txt: Permission denied
stat: cannot statx '/srv/tips/private/notes.txt': Permission denied
```

You cannot even read the mode, which is the tell. `namei -l` walks the path and prints what it finds
at each step, stopping where the kernel stopped:

```bash
namei -l /srv/tips/private/notes.txt
```
```
f: /srv/tips/private/notes.txt
drwxr-xr-x root root /
drwxr-xr-x root root srv
drwxr-xr-x root root tips
drwxr-x--- root root private
                      notes.txt - Permission denied
```

The last directory listed is the one that refused: mode 750 owned by `root:root`, so everyone else
gets `---` and the walk ends there. The file itself is `rw-r--r--` and owned by you, which you can
confirm with `sudo stat` once you know where to look. Run `namei -l` on any path that denies you
before changing a single mode. A home directory at 700, a `/srv` tree owned by a deployment user, or
an encrypted directory that was never unlocked all present as a denial on the file inside.

## The group you are in, and the group your shell has

```bash
cat /srv/tips/reports/summary.csv
stat -c "%A %U %G %n" /srv/tips/reports/summary.csv
id -nG
```
```
cat: /srv/tips/reports/summary.csv: Permission denied
-rw-r----- root tipsdata /srv/tips/reports/summary.csv
user
```

The group bits grant read, the account is in no such group, so the "everyone else" bits apply
instead. Adding yourself to the group is the fix. It is also where this branch gets its
reputation:

```bash
sudo usermod -aG tipsdata user
id -nG
getent group tipsdata
```
```
user
tipsdata:x:1001:user
```

`getent` reads the group database and shows the membership landed. `id` reports the groups the
kernel attached to this process when it started; a running process never picks up one it was not
given at the time. Log out and back in, or start one shell that has it with `newgrp tipsdata`. A service needs
restarting for the same reason. Check the account rather than assuming: `id` takes a username, so
`id www-data` answers for the account the service runs as instead of for you.

Always `-aG` rather than `-G`, incidentally. `usermod -G tipsdata user` sets the supplementary
groups to exactly that list, dropping every other group the account had, which on a personal
account takes `sudo` away with it.

## The write that sudo does not fix

A write refused looks the same and comes from the same check:

```bash
cp /etc/hostname /srv/tips/app.conf
test -w /srv/tips/app.conf; echo "writable: $?"
test -r /srv/tips/app.conf; echo "readable: $?"
```
```
cp: cannot create regular file '/srv/tips/app.conf': Permission denied
writable: 1
readable: 0
```

`test -r` and `test -w` ask the kernel the same question the program asked, as the account running
them, which settles an argument about a mode faster than reading one. Note that writing to a file
needs `w` on the file, while creating or deleting a name needs `w` on the *directory*, so a
read-only file in a directory you own is yours to delete.

One write failure in particular looks like `sudo` doing nothing at all:

```bash
printf 'sudo echo maintenance > /srv/tips/app.conf\n' > deploy.sh
bash deploy.sh
```
```
deploy.sh: line 1: /srv/tips/app.conf: Permission denied
```

The message names `deploy.sh`, and that is the whole diagnosis: your shell set up the redirection
before `sudo` ran, so the file was opened by the unprivileged process. `echo maintenance | sudo tee
/srv/tips/app.conf` puts the privileged program on the opening side instead, which the
[`sudo`](/commands/sudo/) page covers along with the other forms. Any denial whose message begins
with the name of a shell or a script, rather than the name of the command you ran, is this.

## Execute: the bit, then the filesystem

```bash
/srv/tips/backup.sh
echo "status: $?"
```
```
bash: /srv/tips/backup.sh: Permission denied
status: 126
```

Status 126 means the file was found and could not be run, against 127 for a name that was not found
at all, so the two are worth telling apart before assuming a `PATH` problem.
[`chmod +x`](/commands/chmod/) is the usual answer. When the bit is already there, the filesystem is
the next place to look:

```bash
stat -c "%A %U %n" /srv/tips/scratch/run.sh
/srv/tips/scratch/run.sh
findmnt -no TARGET,VFS-OPTIONS /srv/tips/scratch
```
```
-rwxr-xr-x user /srv/tips/scratch/run.sh
bash: /srv/tips/scratch/run.sh: Permission denied
/srv/tips/scratch rw,noexec,relatime
```

Mode `755`, owned by the account running it, and refused. A filesystem mounted `noexec` refuses
every execution on it whatever the modes say. Hardened systems mount `/tmp`, `/dev/shm` and often
`/home` that way, which is where a downloaded installer tends to land. `bash script.sh` still runs
the same file, because the program being executed is then `bash`, which lives somewhere else, and
the script is only data it reads.

`VFS-OPTIONS` rather than the more obvious `OPTIONS` because a [mount](/commands/mount/) carries
two sets of options and only one of them can refuse you anything. The first set is handled by the layer of the kernel
that sits above every filesystem, so the same four work anywhere: `ro`, `noexec`, `nosuid` and
`nodev`. The second belongs to the filesystem driver and tunes how that filesystem behaves rather
than who may do what, `size=` on a tmpfs or the journal mode on ext4. `findmnt -o OPTIONS` prints
both sets run together as one comma-separated list, so the shorter column is the one that answers
the question you asked. Read all four whenever something is refused for a reason the modes do not
explain: `nosuid` is why a setuid program stops elevating, and `ro` is why a write fails on a
filesystem you own outright.

## When the refusal is worded differently

Not every refusal is `EACCES`. The wording says which one you have:

```bash
stat -c "%A %U %n" /srv/tips/shared /srv/tips/shared/report.log
rm /srv/tips/shared/report.log
```
```
drwxrwxrwt root /srv/tips/shared
-rw-r--r-- tipssvc /srv/tips/shared/report.log
rm: cannot remove '/srv/tips/shared/report.log': Operation not permitted
```

The directory is world-writable, which would normally be enough to delete anything in it. The `t` at
the end is the sticky bit, restricting deletes and renames to each file's owner. "Operation not
permitted" is `EPERM`, the errno for an operation no permission bit can grant you; `chmod` on a file
you do not own answers the same way. "Read-only file system" is `EROFS` and is
about the mount rather than about you, which is worth knowing when a machine has remounted its root
read-only after a disk error and every write on it has started failing at once.

## Check the fix as the account that will use it

The last step is the one most often skipped. A permission fixed while logged in as yourself, or
tested with `sudo` in front of it, has been tested as the wrong account:

```bash
sudo -u tipssvc test -r /srv/tips/app.conf; echo "app.conf readable by tipssvc: $?"
sudo -u tipssvc test -r /srv/tips/secrets.env; echo "secrets.env readable by tipssvc: $?"
```
```
app.conf readable by tipssvc: 0
secrets.env readable by tipssvc: 1
```

`sudo -u` runs a command as another account, so the kernel answers for that account's uid and
groups. It is the fastest way to settle whether the service will be able to read its own config,
and it works for any account on the machine: `sudo -u www-data test -x /var/www/html` is the same
question about a web server. Where a whole search is coming back full of denials rather than one
command,
[find files without the permission denied noise](/recipes/find-permission-denied/) is the shape to
use instead of reading past them.
