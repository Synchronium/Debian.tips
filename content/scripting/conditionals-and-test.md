---
title: "Conditionals and test"
description: "The difference between [ and [[ in bash, why unquoted variables crash [ but not [[, and pattern matching with case."
category: scripting
tags: [scripting, beginner]
updated: 2026-07-05
order: 3
related: [variables-and-quoting, exit-codes-and-error-handling]
---

`if` in bash doesn't test anything itself. It runs a command and branches on that command's exit
status. `[` (also spelled `test`) and `[[` are the commands almost always used for that check.

## `[` is a command, not syntax

```bash
count=5
if [ "$count" -gt 3 ]; then
  echo "more than 3"
fi
```
```
more than 3
```

`[` is an actual program (`/usr/bin/[`, though bash also has it built in), and `]` is its final
argument, required so the command knows where its argument list ends. `if` just runs `[ "$count"
-gt 3 ]` and checks whether it exited `0`. This is why spacing around `[` and `]` is mandatory:
they're separate words to the shell, not special syntax it parses differently.

String comparison uses `=` (or `!=`), numeric comparison uses `-eq`, `-ne`, `-gt`, `-lt`, `-ge`,
`-le`:

```bash
name="deb1"
if [ "$name" = "deb1" ]; then
  echo "matched"
fi
```

## Why `[` needs its arguments quoted

```bash
unset myvar
if [ $myvar = "x" ]; then echo yes; fi
```
```
bash: line 1: [: =: unary operator expected
```

With `myvar` unset and unquoted, `[ $myvar = "x" ]` expands to `[ = "x" ]`: only two arguments
where `[` expected three, so it reports a syntax error instead of doing the comparison you meant.

```bash
if [ "$myvar" = "x" ]; then echo yes; else echo "no match, safely"; fi
```
```
no match, safely
```

Quoted, `"$myvar"` expands to an empty string that still counts as an argument, so `[` sees
`[ "" = "x" ]`, three arguments, and evaluates the comparison correctly. This is the same
quoting rule from the previous lesson, showing up again in a new place: unquoted variable
expansions inside `[ ]` are a common source of scripts that work in testing and break the
moment a variable happens to be empty.

## `[[` is a bash keyword, not a command, and more forgiving

```bash
if [[ $myvar = "x" ]]; then echo yes; else echo "no match, still safe"; fi
```
```
no match, still safe
```

`[[ ]]` is bash syntax handled directly by the parser, not a separate program, so it doesn't
word-split or glob-expand its contents the way `[` does. The same unquoted `$myvar` that broke
`[` works fine inside `[[ ]]`. It also supports pattern matching and combined conditions
directly:

```bash
file="report.txt"
if [[ "$file" == *.txt ]]; then echo "is a text file"; fi

count=5
if [[ "$count" -gt 3 && "$count" -lt 10 ]]; then echo "in range"; fi
```

The equivalent with `[` needs `-a` (deprecated and best avoided) or two separate `[ ]` tests
joined with `&&`:

```bash
if [ "$count" -gt 3 -a "$count" -lt 10 ]; then echo "in range via -a"; fi
# or, preferred:
if [ "$count" -gt 3 ] && [ "$count" -lt 10 ]; then echo "in range"; fi
```

`[[ ]]` is bash-only, not portable to a POSIX `sh` script (`#!/bin/sh`). Still quote variable
expansions inside it out of habit; it protects against word splitting, but not against every
edge case, and consistent quoting is easier to maintain than remembering which rule applies
where.

## File test operators

```bash
if [ -f exists.txt ]; then echo "file exists"; fi
if [ -d /tmp ]; then echo "directory exists"; fi
if [ ! -f nope.txt ]; then echo "file does not exist"; fi
```
```
file exists
directory exists
file does not exist
```

`-f` tests for a regular file, `-d` for a directory, `-e` for either existing at all, `-x` for
executable, `-r`/`-w` for readable/writable. `!` negates any test, in both `[` and `[[`.

## `case`: pattern matching without repeated `if`

```bash
ext="txt"
case "$ext" in
  txt|md) echo "text-like" ;;
  jpg|png) echo "image" ;;
  *) echo "unknown" ;;
esac
```
```
text-like
```

Each pattern is a glob, not a regex; `|` separates alternatives within one pattern, and `*)`
acts as the default case, matched only if nothing above it did. `case` reads more clearly than a
long `if`/`elif` chain once there are more than two or three branches.

## Exercises

1. Write a test that prints "empty" if a variable is unset or an empty string, using `[[ ]]`.

   <details><summary>Answer</summary>

   ```bash
   if [[ -z "$myvar" ]]; then
     echo "empty"
   fi
   ```

   `-z` tests for a zero-length string; `-n` is its opposite, testing for a non-empty string.
   </details>

2. Given a variable `path`, write a check using `[` that safely handles `path` being unset,
   testing whether it equals `/tmp`.

   <details><summary>Answer</summary>

   ```bash
   if [ "$path" = "/tmp" ]; then
     echo "matched"
   fi
   ```

   The quotes around `"$path"` are what make this safe when `path` is unset; without them, `[`
   would see too few arguments and error out instead of comparing.
   </details>

3. Write a `case` statement that prints "weekday" for `mon` through `fri` and "weekend" for
   `sat` or `sun`.

   <details><summary>Answer</summary>

   ```bash
   day="sat"
   case "$day" in
     mon|tue|wed|thu|fri) echo "weekday" ;;
     sat|sun) echo "weekend" ;;
     *) echo "not a day" ;;
   esac
   ```
   </details>

## What's next

The next lesson covers loops: iterating over lists, files, and command output safely.
