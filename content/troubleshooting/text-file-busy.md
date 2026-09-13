---
title: "Text file busy"
tagline: "Replacing a program while a copy of it is running"
description: "A deploy failed because the program is running. What ETXTBSY protects, why rm then copy works, and the rename that avoids the window between them."
category: troubleshooting
tags: [files, processes, sysadmin]
updated: 2026-09-13
related: [cp, mv, fuser, lsof, processes-and-signals]
---

Copying a new build over a program that is currently running gets you this:

```bash
cp /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent
```
```
cp: cannot create regular file '/srv/tips/bin/tips-agent': Text file busy
```

`ETXTBSY`, errno 26. The "text" is machine code rather than anything readable: a
running process has its executable mapped into memory and pages of it are read from the file on
demand, so writing into that file would change the instructions under a process already part-way
through them. The kernel refuses instead.

The refusal is on opening the file for writing, so it is not particular to `cp`:

```bash
truncate -s 0 /srv/tips/bin/tips-agent
```
```
truncate: cannot open '/srv/tips/bin/tips-agent' for writing: Text file busy
```

## Which process is holding it

[fuser](/commands/fuser/) with `-v` names the process and says how it is using the file:

<!-- verify: shape the PID belongs to whichever process is running on your machine -->
```bash
fuser -v /srv/tips/bin/tips-agent
```
```
                     USER        PID ACCESS COMMAND
/srv/tips/bin/tips-agent:
                     root        280 ...e. tips-agent
```

The `e` in the `ACCESS` column is the answer: this process is *executing* the file, which is the
only access that produces `ETXTBSY`. A process that merely has the file open shows `f`, and one
that has it open for writing shows `F`. Neither of those stops you writing to it.

Where the program is running several times over, every copy has to go before the file can be
written, and `fuser` lists them all.

## Replacing it anyway

Deleting the file first works, because `rm` removes the name and leaves the inode alone. The
running process is mapped to the inode and never had a claim on the name:

```bash
rm /srv/tips/bin/tips-agent
cp /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent
cmp -s /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent && echo "new build installed"
```
```
new build installed
```

That is the fix most people arrive at, and it has a hole in it. Between the `rm` and the `cp` there
is a window, however brief, in which the path does not exist, so anything trying to start the
program gets "No such file or directory". On a large binary over a slow filesystem that window is
long enough to hit. A `cp` that fails halfway leaves a truncated file that will not run
at all.

Writing the new build beside the old one and renaming it over the top closes both:

```bash
cp /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent.new
mv /srv/tips/bin/tips-agent.new /srv/tips/bin/tips-agent
cmp -s /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent && echo "new build installed"
```
```
new build installed
```

`mv` within one filesystem is a `rename` call, which the kernel performs atomically: the path
points at the old inode or the new one, never at nothing and never at half a file. This is the
same reason `sed -i` and any editor worth using write a temporary file and rename it.

The rename has to be on the same filesystem as the target. Across one, `mv` falls back to copying
and deleting, so the window comes back.

`install` does the whole thing for you, which is why packages use it:

```bash
install -m 755 /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent
cmp -s /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent && echo "new build installed"
```
```
new build installed
```

## The running process keeps the build it started with

Replacing the file changes what starts next. It does not touch what is already running:

```bash
pid=$(pgrep -x tips-agent)
readlink /proc/$pid/exe
cp /srv/tips/releases/tips-agent /srv/tips/bin/tips-agent.new
mv /srv/tips/bin/tips-agent.new /srv/tips/bin/tips-agent
readlink /proc/$pid/exe
```
```
/srv/tips/bin/tips-agent
/srv/tips/bin/tips-agent (deleted)
```

`(deleted)` on a path that plainly exists is the old inode, kept alive by the process still mapped
to it, with no directory entry left pointing at it. The blocks it occupies do not come back
until the process exits, which is the same accounting behind
[No space left on device](/troubleshooting/disk-full/).

So restart the service after deploying, and be careful about reading anything into a `(deleted)`
executable on a machine you did not just deploy to: it means the running process is a version
nobody can now inspect from the filesystem.

## The refusal in the other direction

A file somebody has open for writing cannot be executed, which is `ETXTBSY` again from the other
end:

```bash
env /srv/tips/bin/tips-stage 1
echo "exit status: $?"
```
```
env: '/srv/tips/bin/tips-stage': Text file busy
exit status: 126
```

The upload is still in progress and the kernel will not run a program somebody is in the middle of
writing. A deployment that copies straight to the path it then starts hits this whenever the two
overlap, and the same rename fixes it. Exit status 126 means found and not executable,
which is worth telling apart from 127, meaning not found.

## Shell scripts get no such protection

The kernel protects the interpreter, not the file the interpreter is reading, so a running script
is an ordinary open file:

<!-- verify: shape the PID is this machine's, as above -->
```bash
fuser -v /srv/tips/bin/tips-job
```
```
                     USER        PID ACCESS COMMAND
/srv/tips/bin/tips-job:
                     root        540 f.... tips-job
```

`f` rather than `e`, and the kernel does not refuse a write:

```bash
cp /srv/tips/releases/tips-agent /srv/tips/bin/tips-job
echo "overwrote a running script, exit status: $?"
```
```
overwrote a running script, exit status: 0
```

That permission is worth less than it looks. `bash` reads a script as it goes, keeping a byte
offset into the file rather than a copy of it, so a script rewritten underneath a running instance
carries on at the offset it had reached and executes whatever now happens to be there. The output
is a run of syntax errors mentioning lines that were never in either version, and the tail of the
old script never runs.

Editing a long-running script in place is the everyday version of this. An editor configured to
write a new file and rename it over the original is safe; one configured to write back into the
same inode, and a shell redirect into the path, are not. Deploy a script the way you would deploy
a binary, since `ETXTBSY` is not going to stop you here.
