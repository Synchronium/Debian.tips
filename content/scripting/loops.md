---
title: "Loops"
description: "for, while and until in bash, iterating over files without breaking on spaces, and why a while read loop in a pipeline forgets everything it did."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-18
order: 4
related: [variables-and-quoting, conditionals-and-test, find]
---

Three loop keywords cover almost everything: `for` walks a list you already have, `while` repeats
as long as a command keeps succeeding, and `until` is `while` with the test inverted.

## `for` over a list

```bash
for env in dev staging prod; do
  echo "deploying to $env"
done
```
```
deploying to dev
deploying to staging
deploying to prod
```

The list is words, split the way the shell splits any other words, which is why the loop
variable needs quoting when you use it and why an unquoted list is a trap. `for` does not know
about files, numbers or ranges — it iterates over whatever words it is given.

## `for` over files

Give it a glob, not the output of `ls`:

```bash
for f in *.txt; do
  echo "found $f"
done
```
```
found notes.txt
found report.txt
```

The shell expands `*.txt` into a sorted list of real filenames, one word each, spaces and all.
`for f in $(ls *.txt)` looks equivalent and is not: `ls` prints its results as text, the shell
then splits that text on whitespace, and a file called `meeting notes.txt` arrives as two
iterations. The glob never has that problem, so reach for it every time.

One thing to know: a glob that matches nothing is left as the literal pattern, so the loop body
runs once with `f` set to `*.txt`. Guard it when that matters:

```bash
for f in *.csv; do
  [ -e "$f" ] || continue
  echo "found $f"
done
echo "done"
```
```
done
```

## Counting, when you actually need a number

```bash
for i in 1 2 3; do echo "attempt $i"; done
for i in {1..3}; do echo "attempt $i"; done
for ((i = 1; i <= 3; i++)); do echo "attempt $i"; done
```

All three print the same thing. `{1..3}` is brace expansion and cannot take a variable as its
bound, which is the usual reason people move to the C-style third form: `{1..$n}` does not
expand, while `((i <= n))` reads `n` normally.

## `while` and reading a file line by line

`while` runs its body as long as its command succeeds. Paired with `read`, that is how you walk a
file:

```bash
while IFS= read -r line; do
  echo "[$line]"
done < paths.list
```
```
[  /var/log/app.log]
[C:\temp\file]
[/srv/data]
```

`IFS=` and `-r` are both doing something, and leaving either off is the most common bug in
shell scripts that process text. Without them:

```bash
while read line; do
  echo "[$line]"
done < paths.list
```
```
[/var/log/app.log]
[C:tempfile]
[/srv/data]
```

`IFS=` for that one command stops `read` from trimming leading and trailing whitespace, and `-r`
stops it treating a backslash as an escape character. The first line lost its indentation and
the second lost its backslashes entirely. Nothing warned, and the data is simply wrong.

> [!WARNING]
> A `while read` loop on the wrong side of a pipe runs in a subshell, so anything it assigns is
> discarded when the loop ends. `cat file | while read line; do count=$((count + 1)); done` leaves
> `count` empty afterwards. Redirect from the file with `< file`, as above, or feed the loop with
> `< <(command)` process substitution. This is the single most confusing thing about loops in
> bash, because the loop plainly runs and the variable plainly does not change.

Here is the difference, in one script:

```bash
count=0
printf 'a\nb\n' | while read -r line; do count=$((count + 1)); done
echo "after a pipe: $count"

count=0
while read -r line; do count=$((count + 1)); done < <(printf 'a\nb\n')
echo "after process substitution: $count"
```
```
after a pipe: 0
after process substitution: 2
```

## `until`, `break` and `continue`

`until` repeats while its command *fails*, which suits waiting for something to come true:

```bash
n=1
until [ "$n" -gt 3 ]; do
  echo "n is $n"
  n=$((n + 1))
done
```
```
n is 1
n is 2
n is 3
```

`break` leaves the loop, `continue` skips to the next iteration. Both take a number to act on an
outer loop (`break 2`), which is occasionally the neat answer and more often a sign the inner
loop wants to be a function.

```bash
for f in notes.txt report.txt missing.txt; do
  [ -e "$f" ] || continue
  echo "processing $f"
done
```
```
processing notes.txt
processing report.txt
```

## Exercises

1. Print every `.txt` file in the current directory with its line count, handling filenames
   containing spaces.

   <details><summary>Answer</summary>

   ```bash
   for f in *.txt; do
     echo "$f: $(wc -l < "$f") lines"
   done
   ```

   The glob supplies each name as one word; `"$f"` keeps it that way when `wc` is called.
   Using `wc -l < "$f"` rather than `wc -l "$f"` stops `wc` printing the filename too.
   </details>

2. Read `paths.list` and count how many lines it has, using a `while` loop, so that the count is
   still available after the loop.

   <details><summary>Answer</summary>

   ```bash
   count=0
   while IFS= read -r line; do
     count=$((count + 1))
   done < paths.list
   echo "$count lines"
   ```

   Redirecting with `< paths.list` keeps the loop in the current shell. Piping `cat paths.list`
   into it would put the loop in a subshell and `count` would still be `0`.
   </details>

3. Why does `for i in {1..$n}` not work, and what does it do instead?

   <details><summary>Answer</summary>

   Brace expansion happens before variable expansion, so bash never sees a number to count to.
   The loop runs exactly once with `i` set to the literal string `{1..3}` (or whatever `$n`
   expands to). Use `for ((i = 1; i <= n; i++))`, or `seq`.
   </details>

## What's next

[Script arguments](/scripting/script-arguments/) comes next: how a script reads what it was
called with, why `"$@"` and `"$*"` are not the same thing, and parsing real flags with
`getopts`.
