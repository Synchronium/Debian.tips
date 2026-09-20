---
title: "env and printenv"
tagline: "Read the environment, and change it for one command"
description: "Tested env and printenv examples: reading a variable, running one command with a changed environment, and what -S fixes on a shebang line."
category: commands
tags: [environment, scripting, sysadmin]
updated: 2026-09-18
tier: standard
related: [environment-variables-and-path, variables-and-quoting, which-vs-type-vs-command, sudo, crontab]
---

`printenv` prints what a process was handed. `env` prints the same thing, but it is more often
used for its other job: running a command with an environment you have changed, for that command
and nothing else.

Both are programs on disk rather than shell builtins, so both see only what was exported. A shell
variable that has never been exported is visible to the shell but is invisible to anything it
starts, so `printenv GREETING` can print nothing and still have answered the question.
[Environment variables and PATH](/concepts/environment-variables-and-path/) describes the model
the rest of this follows from.

`env NAME=value command` and the shell's own `NAME=value command` prefix do the same thing. While
the prefix is shorter, `env` is needed where the prefix cannot go: after `sudo`, which builds a fresh
environment and ignores assignments made in front of it; on a shebang line, where the kernel
allows one program and one argument; and with `-i` or `-u`, which take variables away rather than
adding them. `-i` starts the command from an empty environment, close to what
[cron](/commands/crontab/) or a systemd unit hands a job. Reproducing that at your own prompt is
most of the diagnosis when a script works as you type it and fails on a schedule.

Prefer `printenv NAME` to `echo "$NAME"` when the value itself is the question. Unquoted,
`echo $PATTERN` is expanded by the shell before `echo` runs, so a value containing `*` comes back
as a list of filenames; `printenv` is a separate process and hands back what is stored. Its exit
status also separates a variable set to nothing from one that was never set, which `echo` has no
way to report.

Both of the common surprises come from the shell running first. `env GREETING=hello echo
"$GREETING"` prints an empty line, because `$GREETING` was expanded before `env` existed. And `env`
execs a real program, so it cannot run a builtin, a function or an alias: there is no file called
`cd` for it to execute, so `env cd /tmp` reports that `cd` was not found.
