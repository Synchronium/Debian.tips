---
title: "Functions"
tagline: "Arguments, return status, and keeping variables local"
description: "Defining bash functions, why return gives a status not a value, how to hand data back, and why local separates a helper from a landmine."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-18
order: 6
related: [script-arguments, exit-codes-and-error-handling, loops]
---

A function groups commands under a name so you can call them more than once. Two spellings
exist; the first is the portable one and the one to use:

```bash
greet() {
  echo "Hello, $1"
}

greet deb1
greet "the whole team"
```
```
Hello, deb1
Hello, the whole team
```

Inside a function, `$1` and `$2` are the *function's* arguments, not the script's, and `$#` counts
them. `$0` is the exception: it stays the script's own name, because a function is not a separate
program. This is the same set of rules as
[Script arguments](/scripting/script-arguments/), applied one level in.

A function must be defined before it is called. Bash reads a script top to bottom, so a call
placed above its definition fails with "command not found", which is why helper definitions
conventionally sit at the top and the work happens at the bottom.

## `return` gives back a status, not a value

This is the part that surprises anyone arriving from another language. `return` sets an exit
status: an integer from 0 to 255, where 0 means success. It cannot hand back a string, and a
function's status is the status of its last command unless you say otherwise.

That makes functions usable directly as conditions:

```bash
is_big() { [ "$1" -gt 3 ]; }

if is_big 5; then echo "5 is big"; fi
if is_big 1; then echo "unreachable"; else echo "1 is not big"; fi
```
```
5 is big
1 is not big
```

`is_big` contains no `return` at all. The status of `[ "$1" -gt 3 ]` is the function's status, and
`if` branches on it exactly as it would for any command.

`return` and `exit` are not interchangeable. `return` leaves the function; `exit` ends the whole
script, wherever it was called from:

```bash
check() {
  if [ -z "$1" ]; then
    echo "no argument given"
    return 1
  fi
  echo "got $1"
}

check || echo "check failed, but the script continues"
check hello
```
```
no argument given
check failed, but the script continues
got hello
```

Using `exit 1` there would have stopped the script at the first call, and the two lines after it
would never have printed. A function that might be reused wants `return`, so its caller decides
what a failure means.

## Handing back a value

Since `return` only carries a number, a function that computes something prints it and the caller
captures that with command substitution:

```bash
newest_file() {
  ls -t "$1" | head -1
}

latest=$(newest_file /etc)
echo "captured: ${latest:+something}"
```
```
captured: something
```

The trade is that anything else the function prints ends up in the captured value too, so a
function used this way should send progress messages to stderr (`>&2`) and keep stdout for the
result alone.

## `local`, and what happens without it

Every variable in bash is global by default, including ones first assigned inside a function.
A helper that forgets `local` reaches out and overwrites its caller's state:

```bash
name="outer"
clobber() { name="inner"; }
safe() { local name="inner"; }

clobber
echo "after clobber: $name"

name="outer"
safe
echo "after safe:    $name"
```
```
after clobber: inner
after safe:    outer
```

Both functions look identical from the outside. One of them quietly changed a variable belonging
to code it knows nothing about, and in a longer script that is a bug you find by accident, days
later, in a completely different function. Declare every variable a function assigns as `local`,
including loop counters.

> [!WARNING]
> `local` is itself a command, and its exit status is its own, not that of the command
> substitution you assigned from. So `local out=$(some_command)` always succeeds, and
> `set -e` will not catch a failure there. Declare first, assign second, when the status matters.

```bash
masked() { local out=$(false); echo "with local:      $?"; }
checked() { local out; out=$(false); echo "declared first:  $?"; }

masked
checked
```
```
with local:      0
declared first:  1
```

The first reports success for a command that failed. This one is genuinely hard to spot
by reading, and it is worth knowing before you rely on
[error handling](/concepts/exit-codes-and-error-handling/) inside a function.

## Exercises

1. Write a function `require` that prints a message to stderr and returns 1 when its argument is
   empty, and use it without stopping the script.

   <details><summary>Answer</summary>

   ```bash
   require() {
     if [ -z "$1" ]; then
       echo "required value missing" >&2
       return 1
     fi
   }

   require "" || echo "carrying on anyway"
   ```

   `return 1` rather than `exit 1` is what leaves that decision to the caller.
   </details>

2. Why does this print `0`, and how would you fix it?

   ```bash
   count_lines() { local n=$(wc -l < missing.txt); }
   ```

   <details><summary>Answer</summary>

   The exit status belongs to `local`, not to `wc`, so the failure to open `missing.txt` is
   discarded. Split the declaration from the assignment:

   ```bash
   count_lines() {
     local n
     n=$(wc -l < missing.txt) || return 1
   }
   ```
   </details>

3. A function needs to return both a count and a name. How?

   <details><summary>Answer</summary>

   Print both and let the caller split them, or assign to variables the caller names. The
   simplest reliable form is printing one per line and reading them:

   ```bash
   stats() { echo "12"; echo "deb1"; }
   { read -r count; read -r host; } < <(stats)
   ```

   `return` cannot do it: it carries a single number between 0 and 255, which is a status and not
   a value.
   </details>

## What's next

That is the core of the language: variables, conditions, loops, arguments and functions. The two
lessons after this one are about the values themselves rather than the control flow around them,
[Arrays](/scripting/arrays/) and [Parameter expansion](/scripting/parameter-expansion/). For a
script that has to run unattended, the pieces to add are `trap` for cleanup, `set -euo pipefail`,
and the error-handling patterns in
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/).
