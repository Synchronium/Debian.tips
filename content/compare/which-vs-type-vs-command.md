---
title: "which vs type vs command -v"
tagline: "What a name can be, and which tool can see it"
description: "which searches PATH and nothing else, so it reports that cd does not exist. What type and command -v answer instead, and which one belongs in a script."
category: compare
tags: [environment, scripting, beginner]
updated: 2026-09-05
related: [which, cd, environment-variables-and-path, sudo-command-not-found]
---

Ask `which` about `cd` and it tells you there is no such command:

```bash
which cd; echo "exit: $?"
```
```
exit: 1
```

Nothing printed, and a failure status. `cd` works perfectly well, so the answer is wrong in any
useful sense, and a script that tests for a command this way will refuse to run on a system where
everything it needs is present.

The reason is not a bug. `which` searches `PATH` for an executable file, and that is all it has
ever claimed to do. `cd` is not a file.

## A name at your prompt can be five different things

When you type a word, the shell resolves it against five kinds of thing, in a fixed order. `type
-t` names the kind:

```bash
shopt -s expand_aliases
alias ll="ls -l"
greet() { echo hi; }
for n in ls cd greet ll if; do printf "%-6s %s\n" "$n" "$(type -t "$n")"; done
```
```
ls     file
cd     builtin
greet  function
ll     alias
if     keyword
```

Only the first of those is a file on disk. A builtin is compiled into the shell, a function and
an alias were defined by your configuration or by the current session, and a keyword is part of
the shell's grammar. `which` is a separate program that gets none of this: it is handed a name,
it looks through the directories in `PATH`, and it reports what it found there.

The `shopt -s expand_aliases` line is only needed because these examples run non-interactively.
At a prompt, aliases are already on.

## What each one answers

Put the three side by side and the pattern is immediate:

```bash
shopt -s expand_aliases
alias ll="ls -l"
greet() { echo hi; }
for n in ls cd greet ll; do
  printf "%-6s which=%s type=%s\n" "$n" "$(which "$n" 2>/dev/null || echo -)" "$(type -t "$n")"
done
```
```
ls     which=/usr/bin/ls type=file
cd     which=- type=builtin
greet  which=- type=function
ll     which=- type=alias
```

`which` answers for one of the four. `type` answers for all of them, because `type` is a shell
builtin and the shell is what does the resolving in the first place.

`command -v` is the third option, and it splits the difference deliberately. It prints a path for
anything that is a file and the bare name for anything that is not:

```bash
greet() { echo hi; }
command -v ls; command -v cd; command -v greet | head -1
```
```
/usr/bin/ls
cd
greet
```

Check that before you capture the result. `path=$(command -v cd)` gives you the string `cd`, not
a path, and running `"$path"` afterwards looks for a file of that name in the working directory.

## Which to use

**In a script, `command -v`.** It is specified by POSIX, so it is present in dash and every other
POSIX shell as well as bash, and it is a builtin, so it starts no process. The guard at the top of
a script is the common case, and only the status matters:

```bash
for c in jq definitely-not-installed; do
  if command -v "$c" >/dev/null 2>&1; then echo "$c: available"; else echo "$c: not installed"; fi
done
```
```
jq: available
definitely-not-installed: not installed
```

**At a prompt, `type`.** It says more, and `type -a` shows every candidate rather than the winner
alone:

```bash
type -a ls
```
```
ls is /usr/bin/ls
ls is /bin/ls
```

Two answers for one program, because Debian's usrmerge makes `/bin` a symlink to `/usr/bin` and
both paths are on `PATH`.

**`which` when you want the file and nothing else**, on a system where you know it is a command
you are asking about. `type -P` does the same job without leaving the shell:

```bash
type -P ls; type -P cd; echo "cd: $?"
```
```
/usr/bin/ls
cd: 1
```

## Where the distinction actually bites

A function can share a name with the command it wraps, and inside it, `command` is what reaches
past the function to the file:

```bash
ls() { echo "my ls"; }
ls
command ls -d .
```
```
my ls
.
```

Without `command` on the second line, the function would call itself until the shell ran out of
stack. This is the standard shape for a wrapper, and it is also why a `which ls` that reports
`/usr/bin/ls` can be perfectly true and still not tell you what will run.

## Debian's which is its own program

Debian does not ship the GNU `which`. It is a small `/bin/sh` script from `debianutils`, it takes
`-a` and `-s` and no other options, and it was deprecated in 2021 and then un-deprecated by a
Technical Committee ruling. [The `which` page](/commands/which/) covers what that means in
practice, including the flags that are not there and the ones that are.
