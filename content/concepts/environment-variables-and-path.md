---
title: "Environment variables and PATH"
tagline: "Why a program you can run is still not found"
description: "Why a program you can see and execute is still not found, how the environment is copied into each new process, and where PATH is really set on Debian."
category: concepts
tags: [environment, scripting, terminal]
updated: 2026-08-23
related: [sudo-command-not-found, variables-and-quoting, pipes-and-redirection, file-permissions-explained]
---

A script can be present, executable, and owned by you, and the shell will still refuse to run it
by name:

```bash
mkdir -p ~/bin
printf '#!/bin/sh\necho this is my own hello\n' > ~/bin/hello
chmod +x ~/bin/hello
hello
```
```
bash: hello: command not found
```

Nothing is wrong with the file. `command not found` is the shell reporting that it looked in the
directories it searches and `~/bin` was not among them.

## The environment is a copy, made at exec time

Every process gets a block of `NAME=value` strings from whatever started it. The kernel hands that
block over when the program is executed, and from then on it belongs to the new process. Changes a
child makes are changes to its own copy.

This one fact explains most of the surprising behaviour. A variable set in your shell is not
automatically part of that block:

```bash
GREETING=hello
echo "$GREETING"
bash -c 'echo "child sees: [$GREETING]"'
```
```
hello
child sees: []
```

`GREETING` exists as a **shell variable**, visible to the shell itself and to nothing it starts.
`export` moves it into the block that children receive:

```bash
export GREETING=hello
bash -c 'echo "child sees: [$GREETING]"'
```
```
child sees: [hello]
```

You can also set one for a single command, without affecting the shell at all, by putting the
assignment in front of the command:

```bash
GREETING=hello bash -c 'echo "just for this command: [$GREETING]"'
```
```
just for this command: [hello]
```

Because the copy only ever travels downward, a script cannot change the environment of the shell
that ran it:

```bash
printf '#!/bin/sh\nexport CHANGED=yes\n' > setit.sh
chmod +x setit.sh
./setit.sh
echo "parent sees: [${CHANGED:-nothing}]"
```
```
parent sees: [nothing]
```

Sourcing the file with `.` runs those lines in the current shell instead of a new one, which is
why installers tell you to run `. ~/.profile` rather than executing it:

```bash
printf 'export CHANGED=yes\n' > setit.sh
. ./setit.sh
echo "parent sees: [${CHANGED:-nothing}]"
```
```
parent sees: [yes]
```

## How the shell finds a command

`PATH` holds directories separated by colons. When you type a command with no slash in it, the
shell tries each directory in turn and runs the first match it finds:

```bash
printenv PATH
```
```
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games
```

`type` reports what a name resolves to, and `type -a` lists every candidate in search order:

```bash
type ls
type -a echo
```
```
ls is /usr/bin/ls
echo is a shell builtin
echo is /usr/bin/echo
echo is /bin/echo
```

Two things are worth reading off that output. A builtin beats anything on disk, so `echo` never
reaches `/usr/bin/echo` from an interactive shell. And `/usr/bin/echo` comes before `/bin/echo`
because `/usr/bin` comes first in `PATH`, not because one is more real than the other.

Position therefore decides which copy of a name you get. Prepending a directory shadows the system
version; appending it provides a fallback for names nothing else supplies:

```bash
mkdir -p ~/bin
printf '#!/bin/sh\necho not the real one\n' > ~/bin/sort
chmod +x ~/bin/sort
PATH="$HOME/bin:$PATH" command -v sort
PATH="$PATH:$HOME/bin" command -v sort
```
```
/home/user/bin/sort
/usr/bin/sort
```

This completely fixes the opening example:

```bash
mkdir -p ~/bin
printf '#!/bin/sh\necho this is my own hello\n' > ~/bin/hello
chmod +x ~/bin/hello
PATH="$HOME/bin:$PATH" hello
```
```
this is my own hello
```

Keep `$PATH` on the right-hand side when you extend it. Writing `PATH="$HOME/bin"` alone replaces
the list, so the next command you type will not be found either.

## Where PATH is set on Debian

The value you see depends on how the shell was started, which is why a change can appear to work
in one terminal and not in another:

```bash
bash -lc 'echo $PATH'
```
```
/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games
```

That is a **login** shell, built from `/etc/profile` and `~/.profile`. The non-login interactive
shell above had a different list, inherited from whatever started it. Interactive is a third
question again, answered by
[whether the shell has a terminal](/concepts/terminal-shell-and-tty/). On Debian:

- `/etc/environment` is read by PAM for every login session. It is a plain list of
  `NAME=value` lines, not a script, so `PATH="$PATH:/opt/bin"` does not work there.
- `/etc/profile` and `~/.profile` run for login shells. `~/.profile` is where a user's own
  `PATH` addition belongs, and Debian's default already adds `~/bin` if it exists.
- `~/.bashrc` runs for interactive non-login shells. Debian's default `~/.profile` sources
  `~/.bashrc`, which is why edits there often seem to work for both.
- A [systemd service](/debian/systemd-services/) inherits almost nothing from any of these.
  Units get a minimal environment and need `Environment=` or `EnvironmentFile=` set explicitly.
- [cron](/commands/crontab/) is the same story and catches more people, because a job that works
  when you type it fails at 03:00 with no `PATH` worth the name.

Log out and back in after editing any of them. Sourcing the file only fixes the shell you are
sitting in.

## sudo does not use your PATH

`sudo` builds a fresh environment rather than passing yours through, and Debian compiles it with
`secure_path` set:

```bash
sudo grep secure_path /etc/sudoers
```
```
Defaults	secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
```

So `sudo` searches that list and no other:

```bash
sudo printenv PATH
```
```
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

A binary in `~/bin` or `/opt/something/bin` is invisible to `sudo` however well it works for you,
which produces the confusing pairing of a command that runs fine and then reports
`command not found` the moment you put `sudo` in front of it. Give the full path, or use
`sudo env "PATH=$PATH" thecommand` when you have decided that is acceptable.
[sudo: command not found](/troubleshooting/sudo-command-not-found/) covers the diagnosis in more
detail.

## Common misconceptions

**`export` is not global.** It affects processes started afterwards, from this shell. Other
terminals, running programs and your desktop session are unaffected, and there is no supported way
to push a variable into a process that is already running.

**An empty variable and an unset one are different.** `${VAR:-default}` supplies the default for
both, `${VAR-default}` only for genuinely unset, and `printenv VAR` prints an empty line for the
first and nothing for the second. [Parameter expansion](/scripting/parameter-expansion/) has the
rest of that family, including `${VAR:?message}` for the variables a script cannot guess at.

**Quote the expansion.** `export DIR=$HOME/my documents` sets `DIR` to something that ends at the
space. See [variables and quoting](/scripting/variables-and-quoting/) for the general rule, which
applies here exactly as it does anywhere else.

**Never put `.` in `PATH`.** It makes the shell run a program from whatever directory you happen
to be sitting in, which turns a downloaded archive containing a file called `ls` into a trap. If
you want the current directory, `./thing` says so explicitly.

## Go deeper

- [variables and quoting](/scripting/variables-and-quoting/) for shell variables in scripts
- [sudo: command not found](/troubleshooting/sudo-command-not-found/) for the `secure_path` case
- [pipes and redirection](/concepts/pipes-and-redirection/) for the other thing a process
  inherits at exec time
- [file permissions explained](/concepts/file-permissions-explained/) for the executable bit that
  `PATH` search assumes
