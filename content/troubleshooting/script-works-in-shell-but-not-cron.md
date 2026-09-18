---
title: "Works in the shell, fails in cron"
tagline: "The job ran, with almost none of your environment"
description: "cron hands a job five variables and a PATH of /usr/bin:/bin, runs it from your home directory under dash, and sends the failure somewhere you are not looking."
category: troubleshooting
tags: [cron, environment, scripting, sysadmin]
updated: 2026-09-18
related: [crontab, env, environment-variables-and-path, command-not-found, cron-vs-systemd-timers, exit-codes-and-error-handling]
---

The script runs perfectly well when you run it:

```bash
tips-nightly
echo "status: $?"
```
```
report written
status: 0
```

The crontab entry is the one you meant, and the job is still not doing its work:

```bash
crontab -l
```
```
30 3 * * * /usr/local/bin/tips-nightly
```

Nothing is wrong with either. cron started the script and the script failed, because a process
inherits its environment from whatever started it and cron is not your shell.

## What cron hands a job

A job on this machine was scheduled to run `env` and keep what it printed, and this is the file it
left behind:

```bash
cat /var/tmp/tips-cron/env.txt
```
```
HOME=/home/user
LOGNAME=user
PATH=/usr/bin:/bin
SHELL=/bin/sh
PWD=/home/user
```

Five variables, against the thirty or so an interactive session carries. `PATH` is the one that
does the damage:

```bash
printenv PATH
```
```
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games
```

`/usr/local/bin` is where a machine's own scripts live, and it is on your list and not on cron's.
So is `/usr/sbin`, which is where a good deal of what a maintenance job wants lives, and so is
`~/.local/bin`, where `pip install --user` and `pipx` put things.

## Reproduce it at your own prompt

Give a shell that same environment with [`env -i`](/commands/env/) and the failure comes back where
you can watch it:

```bash
env -i HOME=/home/user PATH=/usr/bin:/bin /bin/sh -c /usr/local/bin/tips-nightly
echo "status: $?"
```
```
/usr/local/bin/tips-nightly: 2: tips-report: not found
status: 127
```

That is the answer: the script is found, and a command on line 2 of it is not. Here is what the
real cron job wrote, for comparison:

```bash
cat /var/tmp/tips-cron/run.log
```
```
/usr/local/bin/tips-nightly: 2: tips-report: not found
status: 127
```

Reproducing before changing anything is worth the minute it takes, because the alternative is
editing a crontab and waiting for the schedule to come round to tell you whether you were right.
[command not found](/troubleshooting/command-not-found/) covers the message itself, including the
cases where `PATH` is not the reason.

## Where the failure went

You did not see that message because cron mails a job's output to the owner of the crontab, and on
a machine with no mail transfer agent installed there is nowhere for it to go:

```bash
ls -A /var/mail | wc -l
```
```
0
```

The job ran, failed, and reported it to an empty room. `run.log` above exists because the job that
wrote it was scheduled with its output redirected, which is the habit worth having:

```bash
30 3 * * * /usr/local/bin/tips-nightly >> /var/log/tips-nightly.log 2>&1
```

`2>&1` after the redirect rather than before it, or the error messages stay on the stream you were
trying to capture. Debian's cron also logs the fact that it started a job to syslog, which says
nothing about how the job got on; `journalctl -t CRON` is where that lands on a systemd machine.
Setting `MAILTO` at the top of the crontab is the other route, and it needs an MTA that works:

```bash
MAILTO=ops@example.com
```

## Two fixes, and the one to prefer

Absolute paths inside the script is the fix that keeps working when the job is moved to a systemd
timer, which supplies even less:

```bash
env -i HOME=/home/user PATH=/usr/bin:/bin /bin/sh -c '/usr/local/bin/tips-report'
```
```
report written
```

Setting `PATH` in the crontab is the other, and it applies to every job in that file:

```bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * /usr/local/bin/tips-nightly
```

Write the list out; `PATH=$PATH:/usr/local/bin` does not work there, because a crontab is not a
script and no shell expands the variable. The same goes for any other assignment at the top of the
file: they are literal `NAME=value` lines, read by cron itself.

## /bin/sh is dash, not bash

`SHELL=/bin/sh` in that capture is not a formality. It is a different shell:

```bash
env -i HOME=/home/user PATH=/usr/bin:/bin /bin/sh -c 'readlink /proc/$$/exe'
```
```
/usr/bin/dash
```

A script whose first line says `#!/bin/bash` is safe, since the kernel honours the shebang and cron
never gets a say. A script with no shebang at all, or one run as `sh script.sh` from the crontab
line, is handed to dash, and every bash-only construction in it stops working:

```bash
printf '#!/bin/sh\nif [[ -f /etc/hostname ]]; then echo yes; fi\n' > check
chmod +x check
./check
echo "status: $?"
```
```
./check: 2: [[: not found
status: 0
```

Two things went wrong there. `[[` is a bash keyword and dash has never had it, and the script
exited 0 anyway, because a failing command inside an `if` is a condition that came out false rather
than an error. [sh vs bash vs dash](/compare/sh-vs-bash-vs-dash/) has the rest of the constructions
that differ, and `checkbashisms` from the `devscripts` package finds them in a file.

## The working directory is your home

`PWD=/home/user` in the capture is where cron put the job, whatever directory the script lives in:

```bash
env -i HOME=/home/user PATH=/usr/bin:/bin /bin/sh -c 'cd "$HOME"; pwd'
```
```
/home/user
```

So a script that opens `config.ini`, writes `output.csv` or runs `./helper` is reading and writing
in a home directory. It usually works when you test it, because you tested it from the directory
the script is in. Put a `cd` at the top of the script, and give `cd` an absolute path.

## The status nobody is reading

```bash
env -i HOME=/home/user PATH=/usr/bin:/bin /bin/sh -c '/usr/local/bin/tips-nightly'
echo "status: $?"
```
```
/usr/local/bin/tips-nightly: 2: tips-report: not found
status: 127
```

127, and cron does nothing with it. A job that fails every night at 03:30 goes on failing until
somebody notices the work has not been done, which is the case for a `set -e` at the top of a
script and a monitoring check on the result rather than on the job.
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/) covers the first,
and [cron vs systemd timers](/compare/cron-vs-systemd-timers/) covers the second: a timer's
`systemctl status` remembers the last result, which a crontab has no way to do.

## When the environment is not the problem

Three failures produce the same symptom with `PATH` in perfect order, and each has its own tell.

A `%` in the command is a newline to cron, and everything after the first one becomes standard
input for the job. `date +%F` in a crontab runs `date +` and feeds it an `F`, so escape every one
as `\%`:

```bash
30 3 * * * /usr/local/bin/tips-nightly --date=$(date +\%F)
```

A crontab file whose last line has no newline is ignored from that line on, which
[crontab](/commands/crontab/) avoids by editing through `crontab -e` rather than writing the spool
file directly. And a job that never appears to run at all, with nothing in the log either, is worth
checking against `/etc/cron.allow` and `/etc/cron.deny` before anything else: an account named in
neither, on a machine that has an `allow` file, is refused cron entirely.
