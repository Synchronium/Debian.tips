---
title: "Variables and quoting"
description: "Why unquoted variables break bash scripts, when to use double vs single quotes, and how glob characters make it worse."
category: scripting
tags: [scripting, beginner]
updated: 2026-07-05
order: 2
related: [your-first-script, exit-codes-and-error-handling]
---

This is the single biggest source of bash bugs, and the fix is one habit: **quote your
variables.**

## Setting and using a variable

```bash
name="deb1"
echo "Hello, $name"
```

No spaces around `=`. `name = "deb1"` is a syntax error, because bash parses it as running a
command called `name` with arguments `=` and `"deb1"`.

## Why unquoted variables break

```bash
file="my backup.tar.gz"
rm $file
```
```
rm: cannot remove 'my': No such file or directory
rm: cannot remove 'backup.tar.gz': No such file or directory
```

Without quotes, bash performs *word splitting* on the variable's value before passing it to
`rm`, so `rm $file` actually runs `rm my backup.tar.gz`: two arguments, neither of which is a
file that exists. The file is untouched, but only by luck; if a file named `my` or `backup.tar.gz`
had existed, this would have deleted the wrong thing.

```bash
rm "$file"
```

Quoted, `$file` expands to a single argument, spaces and all, and the actual file gets removed.

> [!WARNING]
> This isn't just a style preference. Unquoted variables containing spaces or glob characters
> can cause a script to delete or operate on the wrong files entirely. Quote by default, and
> treat an unquoted variable expansion in a script as something to double-check, not skip past.

## Word splitting and globbing are two separate dangers

```bash
pattern="*.txt"
echo $pattern
echo "$pattern"
```
```
a.txt b.txt
*.txt
```

Unquoted, `$pattern` isn't just word-split, it's also handed to the shell's filename expansion
(globbing), so `*.txt` turns into whatever files happen to match in the current directory.
Quoted, it stays the literal string `*.txt`. This is a second, independent reason an unquoted
variable can do something you didn't intend, on top of word splitting.

## Double quotes vs single quotes

```bash
name="deb1"
echo "Hello, $name"
echo 'Hello, $name'
```
```
Hello, deb1
Hello, $name
```

Double quotes allow variable and command expansion inside them; single quotes suppress it
entirely, treating everything between them as literal text. Use single quotes for text you
want passed through unexpanded, commonly an `awk` or `sed` script handed to those commands as an
argument, where `$1` or `$name` should mean something to `awk`, not to bash.

## Arrays need quoting too, and for the same reason

```bash
arr=("one two" "three")
for x in "${arr[@]}"; do echo "item: $x"; done
for x in ${arr[@]}; do echo "unquoted: $x"; done
```
```
item: one two
item: three
unquoted: one
unquoted: two
unquoted: three
```

`"${arr[@]}"` (quoted) expands to each array element as its own word, spaces and all.
`${arr[@]}` (unquoted) re-splits every element on whitespace first, turning two elements into
three words. The same rule from the top of this lesson applies here without exception: quote
the expansion.

## Giving a variable a default value

```bash
echo "${myvar:-default value}"
```

`${var:-default}` expands to `$var` if it's set and non-empty, or the literal `default`
otherwise, without changing `$var` itself. It is a common way to write a script argument or
environment variable that works whether or not the caller provided one.

## Exercises

1. Given `dir="Project Files"`, write a command that safely creates that directory, handling
   the space correctly.

   <details><summary>Answer</summary>

   ```bash
   dir="Project Files"
   mkdir "$dir"
   ```

   Without the quotes, `mkdir $dir` would try to create two directories, `Project` and `Files`.
   </details>

2. What does `echo 'Total: $((2 + 2))'` print, and why doesn't it show `4`?

   <details><summary>Answer</summary>

   It prints the literal text `Total: $((2 + 2))`. Single quotes suppress all expansion,
   including arithmetic expansion, not just variable expansion. Switching to double quotes,
   `echo "Total: $((2 + 2))"`, would print `Total: 4`.
   </details>

3. Given an array `files=("report.pdf" "notes with spaces.txt")`, write a loop that prints each
   filename on its own line, correctly handling the one with spaces.

   <details><summary>Answer</summary>

   ```bash
   files=("report.pdf" "notes with spaces.txt")
   for f in "${files[@]}"; do
     echo "$f"
   done
   ```

   Both the array expansion (`"${files[@]}"`) and the loop variable (`"$f"`) need quotes; missing
   either one reintroduces word splitting.
   </details>

## What's next

The next lesson covers `[` vs `[[` and how bash actually evaluates conditions.
