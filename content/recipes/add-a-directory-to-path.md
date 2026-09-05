---
title: "Add a directory to your PATH permanently"
tagline: "Debian has already done it for two of them"
description: "How to put a directory on PATH for good on Debian, why ~/.local/bin needs no configuration at all, and what to do for any other directory."
category: recipes
tags: [environment, scripting, sysadmin, beginner]
updated: 2026-08-29
related: [environment-variables-and-path, your-first-script, sh-vs-bash-vs-dash]
---

**Problem:** a script you wrote is in a directory of your own, and running it by name gets you
`command not found`, and [which](/commands/which/) cannot see it either. Exporting `PATH` in the terminal fixes it until you close the terminal.

**Solution:** on Debian, if the directory is `~/.local/bin` or `~/bin`, create it and log in
again. Nothing needs editing.

```bash
mkdir -p ~/.local/bin
printf '#!/bin/sh\necho "hello from mytool"\n' > ~/.local/bin/mytool
chmod +x ~/.local/bin/mytool

bash -lc 'command -v mytool'
bash -lc mytool
```
```
/home/user/.local/bin/mytool
hello from mytool
```

**How it works:**

Debian's stock `~/.profile`, which every account gets from `/etc/skel`, already ends with this:

```bash
tail -9 ~/.profile
```
```
# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/.local/bin" ] ; then
    PATH="$HOME/.local/bin:$PATH"
fi
```

- Both are guarded by `if [ -d ]`, and that test runs **at login**. Creating the directory in a
  shell that is already open changes nothing in that shell, which is why so many answers to this
  question insist you have to edit a file: the person asking created the directory and looked in
  the same terminal.
- `~/.local/bin` is the one to prefer. It is where `pip install --user` and `pipx` put things, so
  it usually exists already on a machine that has installed anything.
- Both are prepended, so a tool of yours shadows one of the same name in `/usr/bin`. That is
  deliberate and occasionally a trap.

**For any other directory,** add the line yourself, at the end of `~/.profile`:

```bash
mkdir -p ~/scripts
printf '#!/bin/sh\necho "hello from deploy"\n' > ~/scripts/deploy
chmod +x ~/scripts/deploy
echo 'export PATH="$HOME/scripts:$PATH"' >> ~/.profile

bash -lc 'command -v deploy'
```
```
/home/user/scripts/deploy
```

Use `$HOME` rather than `~` inside the quotes: `~` is expanded by the shell only at the start of a
word, so `"~/scripts:$PATH"` would put a literal tilde on your `PATH`.

**Making it take effect without logging out:**

```bash
mkdir -p ~/scripts
printf '#!/bin/sh\necho "hello from deploy"\n' > ~/scripts/deploy
chmod +x ~/scripts/deploy
echo 'export PATH="$HOME/scripts:$PATH"' >> ~/.profile

command -v deploy || echo "deploy: not on PATH"
. ~/.profile
command -v deploy
```
```
deploy: not on PATH
/home/user/scripts/deploy
```

`.` (or `source`) runs the file in the current shell, so the assignment survives. Running
`~/.profile` as a command instead would start a child shell, set `PATH` there, and exit. Note
that sourcing it twice puts the directory on `PATH` twice, which is untidy rather than harmful.

**Where this does not reach:**

A login shell reads `~/.profile`. A terminal window that opens a non-login shell does not, and
the same tool is found by one and not the other:

```bash
mkdir -p ~/scripts
printf '#!/bin/sh\necho "hello from deploy"\n' > ~/scripts/deploy
chmod +x ~/scripts/deploy
echo 'export PATH="$HOME/scripts:$PATH"' >> ~/.profile

bash -lc 'command -v deploy'
bash -c 'command -v deploy || echo "deploy: not on PATH"'
```
```
/home/user/scripts/deploy
deploy: not on PATH
```

Neither does `cron`, which gives a job a `PATH` of `/usr/bin:/bin` and nothing else, nor a systemd
unit, which starts with no user environment at all. Both want a full path to the program, or a
`PATH=` line of their own in the crontab or the unit file.
[Environment variables and PATH](/concepts/environment-variables-and-path/) has the whole model:
which file each kind of shell reads, and why the answer differs for `~/.bashrc`.

> [!WARNING]
> Never put `.` or an empty entry on `PATH`, and watch for the empty one, since `PATH="$PATH:"`
> and `PATH=":$PATH"` both add it. An empty entry means the current directory, so a file called
> `ls` dropped into a directory you happen to `cd` into becomes the `ls` you run.
