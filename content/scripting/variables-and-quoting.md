---
title: "Variables and quoting"
description: "Why unquoted variables break bash scripts, and when to use double vs single quotes."
category: scripting
tags: [scripting, beginner]
updated: 2026-07-05
order: 2
---

This is the single biggest source of bash bugs, and the fix is one habit: **quote your
variables.**

## Setting and using a variable

```bash
name="deb1"
echo "Hello, $name"
```

No spaces around `=` — `name = "deb1"` is a syntax error, because bash parses it as running a
command called `name` with arguments `=` and `"deb1"`.

## Why unquoted variables break

```bash
file="my backup.tar.gz"
rm $file
```

Without quotes, bash performs *word splitting* on the variable's value before passing it to
`rm` — so `rm $file` actually runs `rm my backup.tar.gz`, two arguments, neither of which is a
file that exists.

```bash
rm "$file"
```

Quoted, `$file` expands to a single argument, spaces and all.

> [!WARNING]
> This isn't just a style preference — unquoted variables containing spaces or glob characters
> can cause a script to delete or operate on the wrong files entirely. Quote by default.

## Double quotes vs single quotes

```bash
name="deb1"
echo "Hello, $name"   # Hello, deb1 — double quotes allow expansion
echo 'Hello, $name'   # Hello, $name — single quotes suppress it
```

Use double quotes when you want variable/command expansion; use single quotes when you want
the literal text, unexpanded — useful for `awk` and `sed` scripts passed as arguments.
