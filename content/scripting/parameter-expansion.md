---
title: "Parameter expansion"
tagline: "Defaults, trimming, replacing and slicing, without a fork"
description: "Bash parameter expansion: default values with :-, trimming paths with # and %, replacing text with //, and slicing, length and case conversion."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-29
order: 8
related: [variables-and-quoting, arrays, script-arguments]
---

`${var}` can carry an operator that edits the value on its way out. A script that calls
`basename`, `sed` or `cut` to pull a filename apart is often asking for something the shell will
do without starting a process:

```bash
path=/var/log/nginx/access.log

echo "${path##*/}"
echo "${path%/*}"
```
```
access.log
/var/log/nginx
```

All of it happens inside the braces, and none of it tolerates a space: `${path ## */}` is a
`bad substitution` rather than a tidier way of writing the same thing.

## Defaults, and what the colon changes

`${var:-default}` expands to `default` when `var` is unset or empty, without assigning anything.
`${var:=default}` assigns as well. Dropping the colon from either narrows the test to *unset*
alone, which is the distinction between a variable nobody has set and one deliberately set to
nothing:

```bash
unset name
empty=""

echo "unset:            [${name:-deb1}]"
echo "empty:            [${empty:-deb1}]"
echo "unset, no colon:  [${name-deb1}]"
echo "empty, no colon:  [${empty-deb1}]"
```
```
unset:            [deb1]
empty:            [deb1]
unset, no colon:  [deb1]
empty, no colon:  []
```

Most scripts want the colon. An empty `$EDITOR` is no more usable than a missing one, and the
distinction is worth drawing only where the empty string is a legitimate setting.

`${var:+alternative}` is the mirror image: it expands to `alternative` when `var` *does* have a
value, and to nothing when it does not. That is how an optional flag reaches a command line
without an `if`:

```bash
verbose=""
echo "run 1: grep [${verbose:+--line-number}] pattern file"
verbose=yes
echo "run 2: grep [${verbose:+--line-number}] pattern file"
```
```
run 1: grep [] pattern file
run 2: grep [--line-number] pattern file
```

`${var:?message}` refuses to carry on. The shell prints the message to stderr and a
non-interactive shell exits on the spot:

```bash
unset TARGET
bash -c 'echo "starting"; echo "deploying to ${TARGET:?no TARGET set}"; echo "unreachable"'
echo "status: $?"
```
```
starting
bash: line 1: TARGET: no TARGET set
status: 127
```

The third `echo` never ran. This is worth using at the top of any script that reads configuration
from the environment, where the alternative is a `cp` into `/` or an `rm -rf` under an empty
prefix. `set -u` makes every unset variable fatal, but `:?` is the one that can say which variable
and why.

## Trimming from either end

`#` trims a pattern from the front and `%` trims from the back. Doubling the character makes the
match greedy:

```bash
file=access.log.1

echo "shortest from the end:   ${file%.*}"
echo "longest from the end:    ${file%%.*}"
echo "shortest from the front: ${file#*.}"
echo "longest from the front:  ${file##*.}"
```
```
shortest from the end:   access.log
longest from the end:    access
shortest from the front: log.1
longest from the front:  1
```

The pattern is a glob, the same vocabulary as a filename match or a `case` label: `*`, `?` and
`[...]` work, and a regular expression does not. `${file%.log}` with no wildcard at all is the
common case, stripping a known suffix.

> [!WARNING]
> `${path##*/}` and `${path%/*}` are not `basename` and `dirname`, and they diverge exactly where
> a path is unusual. With no slash in it, `${path%/*}` returns the whole string where `dirname`
> returns `.`; with a trailing slash, `${path##*/}` returns nothing where `basename` returns the
> last component. Use the expansions on paths you built yourself, and the commands on paths that
> came from somewhere else.

Applied to an array, the trim runs on every element:

```bash
paths=(/srv/www/index.html "/srv/www/style sheet.css" /srv/www/logo.svg)

printf "[%s]\n" "${paths[@]##*/}"
```
```
[index.html]
[style sheet.css]
[logo.svg]
```

A batch rename becomes a loop with nothing in it but `mv`:

```bash
for f in *.log; do
  mv -- "$f" "${f%.log}.log.old"
done
ls
```
```
access.log.old
error.log.old
report.txt
```

[Renaming files in bulk](/recipes/bulk-rename-files/) goes further into that, including the cases
where the loop is the wrong tool.

## Replacing text inside the value

`${var/from/to}` replaces the first match and `${var//from/to}` replaces every one. Anchor the
pattern to the front with `/#` or to the back with `/%`:

```bash
line=deb1,deb2,deb3

echo "${line/,/ }"
echo "${line//,/ }"
echo "${line/#deb/host}"
echo "${line/%3/X}"
echo "${line//deb/}"
```
```
deb1 deb2,deb3
deb1 deb2 deb3
host1,deb2,deb3
deb1,deb2,debX
1,2,3
```

An empty replacement deletes. `from` is a glob here too, so `${line//[0-9]/}` strips the digits
and `${line//./}` strips literal dots rather than everything.

## Length, slices and case

`${#var}` is the length in characters. `${var:offset}` and `${var:offset:length}` take a
substring, counting from zero:

```bash
line=deb1,deb2,deb3

echo "length: ${#line}"
echo "from 5: ${line:5}"
echo "4 at 5: ${line:5:4}"
echo "last 4: ${line: -4}"
```
```
length: 14
from 5: deb2,deb3
4 at 5: deb2
last 4: deb3
```

The space in `${line: -4}` is required. Without it the shell reads `:-` and gives you the default
operator from the first section instead, silently and with a plausible-looking result.

`^^` upper-cases the whole value, `,,` lower-cases it, and a single character does the first
letter alone:

```bash
name=deb1
echo "${name^^}"
echo "${name^}"

shouty=DEB1
echo "${shouty,,}"
```
```
DEB1
Deb1
deb1
```

## Which of these your shell has

`${var:-default}`, `${var:=default}`, `${var:?message}`, `${var:+alt}`, `${#var}` and all four
trims are POSIX, so they work in dash, which is what `/bin/sh` is on Debian. Replacement,
slicing, case conversion and the array forms are bash extensions: a script using them needs
`#!/usr/bin/env bash` on the first line rather than `#!/bin/sh`.
[sh vs bash vs dash](/compare/sh-vs-bash-vs-dash/) has the rest of that boundary.

Under `sh` there is no graceful degradation:

```bash
dash -c 'line=deb1,deb2; echo ${line//,/ }'
echo "status: $?"
```
```
dash: 1: Bad substitution
status: 2
```

A script that runs under bash on your machine and `sh` on a server fails there and nowhere else.

## Exercises

1. `log=/var/log/app/2026-08-29.log`. Produce `2026-08-29` using one expansion.

   <details><summary>Answer</summary>

   ```bash
   name=${log##*/}     # 2026-08-29.log
   echo "${name%.log}" # 2026-08-29
   ```

   Two, in fact. These forms do not nest: `${${log##*/}%.log}` gets you `bad substitution`, and
   the answer is an intermediate variable rather than a cleverer expansion.
   </details>

2. A script takes an optional output directory. Give it a default of `/tmp` and make it fail
   loudly if the *input* file is missing from the environment.

   <details><summary>Answer</summary>

   ```bash
   outdir=${OUTDIR:-/tmp}
   infile=${INFILE:?set INFILE to the file to process}
   ```

   `:-` for the one with a sensible fallback, `:?` for the one where guessing would be worse than
   stopping.
   </details>

3. Why does `${path:-2}` not give you the last two characters of `$path`?

   <details><summary>Answer</summary>

   Because it is the default-value operator: it expands to the string `2` when `path` is unset or
   empty, and to the whole path otherwise. The substring form needs a space, `${path: -2}`, or
   parentheses, `${path:$((-2))}`.
   </details>

## What's next

Between these forms and [Arrays](/scripting/arrays/), most of the string handling a shell script
needs no longer requires `sed`, `cut` or a subshell to do it.
[Where a script lives](/scripting/where-a-script-lives/) is next, and it uses two of the trims for
the job they are reached for most: taking a path apart.
