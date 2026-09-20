---
title: "command not found"
tagline: "Which search failed, and where it was looking"
description: "The shell says this for a command that is missing, one that is not on PATH, one it remembers in the wrong place, and a script whose interpreter is gone."
category: troubleshooting
tags: [environment, scripting, sysadmin, beginner]
updated: 2026-09-18
related: [env, environment-variables-and-path, which-vs-type-vs-command, sudo-command-not-found, add-a-directory-to-path, which-package-provides-a-file]
---

The shell prints this when it has searched for a command and not found one:

```bash
tips-deploy
echo "status: $?"
```
```
bash: tips-deploy: command not found
status: 127
```

Read the status before anything else, because the neighbouring one means the opposite. 126 is a
file that was found and could not be run, which is a mode or a mount and not a search at all;
[permission denied](/troubleshooting/permission-denied/) discusses this aspect. Everything below is 127.

## Whether anything on the machine has that name

```bash
command -v tree; echo "status: $?"
command -v tips-report
```
```
status: 1
/usr/local/bin/tips-report
```

`command -v` prints the path it would run and exits 1 when there is none, so the first answer here
is that the machine has no `tree` and the second is that `tips-report` is fine. It searches the
same `PATH` the shell does, which is why it is the right thing to ask: checking by hand with
`ls /usr/bin/tree` tests one directory, but the shell may never look in that one.
[which vs type vs command -v](/compare/which-vs-type-vs-command/) covers why it beats `which` here.

An empty answer splits two cases that look identical. Either nothing with that name is installed,
or something is and the search cannot see it. For the first,
[which package provides a file](/debian/which-package-provides-a-file/) finds the package to
install. The rest of this page is the second.

## Installed, and not in any directory on PATH

Software that arrives as a vendor tarball, a language package manager or a `/opt` tree does this
routinely:

```bash
ls /opt/tips/bin
printenv PATH
```
```
tips-deploy
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games
```

The file is there and its directory is not in the list, so the shell was never going to find it.
Running it by full path works, and so does putting the directory on `PATH` for one command:

```bash
env PATH="/opt/tips/bin:$PATH" tips-deploy
```
```
deploying to staging
```

[env](/commands/env/) sets that for only the command you are about to run, which is how to check
the directory is the only problem before changing anything permanent.
[Adding a directory to your PATH](/recipes/add-a-directory-to-path/) is the permanent form, and on
Debian it often means creating `~/.local/bin` rather than editing a file.

## The shell remembering where it used to be

```bash
tips-report
sudo mv /usr/local/bin/tips-report /usr/local/lib/tips/tips-report
tips-report
echo "status: $?"
```
```
report written
bash: /usr/local/bin/tips-report: No such file or directory
status: 127
```

The message names an absolute path, and that is the tell for this one: every other case names the
word you typed. bash caches where it found a command and goes back there, so a
package upgrade or a `mv` between two runs leaves the cache pointing at a file no longer there:

```bash
tips-report
sudo mv /usr/local/bin/tips-report /usr/local/lib/tips/tips-report
hash -r
tips-report
echo "status: $?"
```
```
report written
bash: tips-report: command not found
status: 127
```

`hash -r` empties the cache, so the second attempt searches `PATH` properly and reports what is
actually true: the command has gone from every directory on it. Run `hash -r` whenever something
worked five minutes ago and the error provides a path rather than a name. A new terminal does the same thing, which is why the problem
has a reputation for fixing itself.

## A name that exists only inside your shell

```bash
deploy() { tips-report; }
deploy
printf 'deploy\n' > run.sh
bash run.sh
echo "status: $?"
```
```
report written
run.sh: line 1: deploy: command not found
status: 127
```

A shell function belongs to the shell that defined it. The script gets a shell of its own, which
was never told about it. Aliases are worse off still, since a non-interactive shell does not expand
them at all, so an alias is invisible to a script even when the script is run by the shell that has
it. Note the message here begins with `run.sh:` instead of `bash:`, naming whichever script did the
looking.

The same applies to anything that is not a shell:

```bash
deploy() { tips-report; }
sudo deploy
echo "status: $?"
```
```
sudo: deploy: command not found
status: 1
```

`sudo` execs a program, but a function is not one. So does [cron](/commands/crontab/), and so does
a systemd unit. If a name works at your prompt, but not anywhere else, `type` will say why:
`type deploy` reports a function or an alias, neither of which is a file anything else can run.

## sudo searching a PATH of its own

```bash
env PATH="/opt/tips/bin:$PATH" sudo tips-deploy
echo "status: $?"
```
```
sudo: tips-deploy: command not found
status: 1
```

The `PATH` given to that command reached `sudo` and went no further:

```bash
printenv PATH
sudo printenv PATH
```
```
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

Debian compiles `sudo` with `secure_path`, a fixed list it uses in place of yours, so a command in
`/opt`, `~/.local/bin` or a virtualenv is invisible the moment `sudo` is in front of it. Note the
status is 1 and the message begins with `sudo:`, both different from the shell's own report. Give
the full path, or `sudo env "PATH=$PATH" thecommand` so long as you can trust every directory on
it.

For the other `sudo` message that reads the same way, where `sudo` itself is what is missing,
[sudo: command not found](/troubleshooting/sudo-command-not-found/) is a Debian installer decision
rather than a search.

## A builtin handed to something that is not a shell

```bash
sudo cd /tmp
echo "status: $?"
```
```
sudo: cd: command not found
sudo: "cd" is a shell built-in command, it cannot be run directly.
sudo: the -s option may be used to run a privileged shell.
sudo: the -D option may be used to run a command in a specific directory.
status: 1
```

`cd`, `export`, `ulimit` and `source` are part of the shell, so there is no file anywhere for
another program to exec. `sudo` explains itself here, while `env cd /tmp` gives the bare message
and no advice. What you want is a shell doing the work: `sudo sh -c 'cd /srv && ...'`, or
the `-D` the message suggests.

## The script found, and its interpreter not

```bash
printf '#!/usr/bin/pythn3\nprint(1)\n' > deploy
chmod +x deploy
./deploy
echo "status: $?"
```
```
bash: ./deploy: cannot execute: required file not found
status: 127
```

The script is there and executable. What is missing is the program named on its first line, and
127 is reported for that too. Older shells said `bad interpreter` here, and much of the advice
written about this still quotes that wording; what bash prints now names no interpreter at all. So
read the line yourself:

```bash
printf '#!/usr/bin/pythn3\nprint(1)\n' > deploy
head -1 deploy
```
```
#!/usr/bin/pythn3
```

Two letters of `python3` transposed. A typo is one way to arrive here; the other is a shebang that
names a real interpreter at a path this machine does not put it in, which is common for anything
installed by a version manager or a virtualenv. `#!/usr/bin/env python3` survives that second case,
because `env` searches `PATH` for the name instead of the shebang hardcoding a location. It is no
help against the typo. The [env](/commands/env/) page has what that line can and cannot hold.

A file edited on Windows produces the identical message from a shebang that looks perfect, because
the carriage return at the end of the line is part of the interpreter's name:

```bash
printf '#!/bin/sh\r\necho hi\r\n' > deploy
chmod +x deploy
./deploy
head -1 deploy | od -c
```
```
bash: ./deploy: cannot execute: required file not found
0000000   #   !   /   b   i   n   /   s   h  \r  \n
0000013
```

`od -c` is what shows it, since the carriage return character is otherwise invisible.
`sed -i 's/\r$//' deploy` removes them, and `dos2unix` does the same if it is installed. Running the
script as `bash deploy` succeeds and hides the problem, because the shebang is then just a comment
and the kernel never looks at it.

## PATH replaced instead of extended

```bash
PATH=/opt/tips/bin
tips-deploy
ls
echo "status: $?"
```
```
deploying to staging
bash: ls: command not found
status: 127
```

The one you wanted works and everything else has gone. Any assignment that leaves `$PATH` off the
right-hand side does this, and `PATH="$HOME/bin"` in a `.profile` takes the whole machine with it
until the next login. Write `PATH="$HOME/bin:$PATH"`, and watch for the empty entry as well:
`PATH="$PATH:"` and `PATH=":$PATH"` each leave a colon with nothing beside it, and an empty entry
means whichever directory you are standing in. So after you `cd` into an unpacked archive, a file
in it called `ls` is first on your search path, so typing `ls` runs the archive's copy instead of
the system one. That is why `.` does not belong on `PATH`, spelled out or left empty.
[Environment variables and PATH](/concepts/environment-variables-and-path/) has where each shell
reads its `PATH` from, which is the next question once the value is wrong and you do not know who
set it.
