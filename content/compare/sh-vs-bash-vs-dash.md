---
title: "sh vs bash vs dash"
description: "On Debian /bin/sh is dash, not bash. That one fact explains most scripts that work at your prompt and fail the moment something else runs them."
category: compare
tags: [scripting, debian, beginner]
updated: 2026-08-20
related: [variables-and-quoting, conditionals-and-test, your-first-script]
---

A script runs perfectly when you run it. Then cron runs it, or a package's maintainer script
calls it, or you type `sh script.sh` instead of `./script.sh`, and it fails on a line that was
fine a minute ago.

Almost always, this is the answer:

```bash
readlink /bin/sh
```
```
dash
```

**On Debian, `/bin/sh` is dash.** It is not bash, and it has not been bash for over a decade.

## What each of the three actually is

`sh` is not a program. It is a *specification* — the POSIX shell — and `/bin/sh` is a symlink
pointing at whichever installed shell the system has elected to satisfy it. Writing `#!/bin/sh`
is a promise that your script needs nothing beyond that specification.

`dash` is the Debian Almquist Shell: small, fast, and almost exactly POSIX and no more. Debian
made it `/bin/sh` in Debian 6 for boot speed — every init script at the time was a shell script,
and dash starts and runs measurably faster than bash.

`bash` is the GNU shell, and on Debian it is what you actually get when you log in. It
implements POSIX and then adds a great deal on top, and that extra is what people mean by
"bashisms".

All of them are installed, and the system knows about each:

```bash
cat /etc/shells
```
```
# /etc/shells: valid login shells
/bin/sh
/usr/bin/sh
/bin/bash
/usr/bin/bash
/bin/rbash
/usr/bin/rbash
/usr/bin/dash
```

## What actually differs

Four that account for most real failures. In each, the first line is bash and the second is
`/bin/sh`.

**`[[ ]]` does not exist.** The single most common one, because `[[` is genuinely better than
`[` and every tutorial uses it:

```bash
bash -c '[[ -n $HOME ]] && echo ok'
sh -c '[[ -n $HOME ]] && echo ok'
```
```
ok
sh: 1: [[: not found
```

See [conditionals and test](/scripting/conditionals-and-test/) for the portable `[` forms.

**Arrays do not exist**, and the failure is a syntax error rather than a missing command, so it
takes the whole script down at parse time:

```bash
bash -c 'a=(one two); echo ${a[1]}'
sh -c 'a=(one two); echo ${a[1]}'
```
```
two
sh: 1: Syntax error: "(" unexpected
```

**`echo -e` is worse than unsupported.** dash's `echo` interprets backslash escapes already and
has no `-e` flag, so it prints the flag as text and expands the escape anyway:

```bash
bash -c 'echo -e "a\tb"'
sh -c 'echo -e "a\tb"'
```
```
a	b
-e a	b
```

Nothing errors. The script keeps going with `-e ` glued to the front of a string, which is how
this ends up in a log file three weeks later. `printf` behaves the same in both and is the fix.

**`source` is spelled `.`**:

```bash
sh -c 'source /etc/os-release'
```
```
sh: 1: source: not found
```

```bash
sh -c '. /etc/os-release; echo "$ID"'
```
```
debian
```

`.` works in bash too, so there is no reason to write `source` in a script at all.

## When to use which

Use `#!/bin/bash` whenever you want a bashism. This is not a compromise — bash is installed on
every Debian system, and a script that says what it needs is correct. `[[ ]]`, arrays and
`local` are worth having.

Use `#!/bin/sh` only when the script genuinely stays inside POSIX: something that has to run on
a minimal system, in a container without bash, or as a package maintainer script, where Debian
Policy requires it.

The one thing not to do is write `#!/bin/sh` and then use bashisms anyway. It works on systems
where `/bin/sh` happens to be bash, which is why the bug reaches you from someone else's
machine rather than your own.

Test a `#!/bin/sh` script by actually running it under dash — `dash script.sh` — rather than by
reading it. `checkbashisms`, from the `devscripts` package, catches most of the rest.

## The honest verdict

If you are writing a script for yourself on a Debian machine, use `#!/bin/bash` and stop
thinking about it. The portability you gain from POSIX is real but you are unlikely to spend
it, and a script that quietly misbehaves under dash costs more than one that declares bash.

If you are writing something that ships — a maintainer script, an init script, anything that
runs before the system is fully up — `#!/bin/sh` and dash, tested under dash.

`dpkg-reconfigure dash` is what changes which shell `/bin/sh` points at. It is worth knowing it
exists and worth leaving alone: the boot path expects dash, and pointing `/bin/sh` at bash to
fix one script slows every script on the system to fix a bug you could have fixed in a line.
