---
title: "Arithmetic"
tagline: "Integer maths, numeric comparison, and where floats live"
description: "Integer arithmetic in bash with $(( )) and (( )), -eq against =, why a leading zero is an error, and the awk one-liner for sums bash cannot do."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-29
order: 10
related: [conditionals-and-test, parameter-expansion, loops]
---

`$(( ))` evaluates an arithmetic expression and substitutes the result. Variables inside it need
no `$`, because the whole expression is already being read as arithmetic:

```bash
files=7
per_page=3

echo "pages needed: $(( (files + per_page - 1) / per_page ))"
echo "left over:    $(( files % per_page ))"
echo "doubled:      $(( files * 2 ))"
```
```
pages needed: 3
left over:    1
doubled:      14
```

The usual operators are all there, `+ - * / % **`, along with `< > <= >= == !=`, the bitwise set,
and `? :`. Precedence and spelling are C's.

## `(( ))` is a command, not a substitution

Two parentheses without the `$` evaluate the same expression and throw the value away, keeping
only an exit status: success when the result is non-zero, failure when it is zero. That is
inverted relative to C, and it is what lets arithmetic be used as a condition:

```bash
total=0
for n in 3 5 8; do
  (( total += n ))
done
echo "total: $total"

if (( total > 10 )); then echo "over ten"; fi
(( total == 16 )) && echo "exactly sixteen"
```
```
total: 16
over ten
exactly sixteen
```

> [!WARNING]
> `(( i++ ))` evaluates to `i`'s value *before* the increment, so when `i` is 0 the command
> reports failure, and under `set -e` the script stops there.

```bash
bash -c 'set -e; i=0; (( i++ )); echo "reached: $i"'
echo "status: $?"

bash -c 'set -e; i=0; (( ++i )); echo "reached: $i"'
bash -c 'set -e; i=0; (( i += 1 )); echo "reached: $i"'
```
```
status: 1
reached: 1
reached: 1
```

The first script printed nothing and exited 1 with the increment done. Pre-increment and `+=`
both evaluate to 1, so both survive. This is worth knowing before you turn on `set -e` in a
script that already works.

## Comparing numbers

`[` compares numbers with `-eq -ne -lt -le -gt -ge` and strings with `= !=` and `< >`. Handing
numbers to the string operators is not an error. It sorts them as text, and reports that
correctly:

```bash
a=10
b=9

[ "$a" -gt "$b" ] && echo "with -gt:   10 is greater"
[ "$a" ">" "$b" ] || echo "as strings: 10 is not greater"
(( a > b ))       && echo "inside ((: 10 is greater"
```
```
with -gt:   10 is greater
as strings: 10 is not greater
inside ((: 10 is greater
```

`10` sorts before `9` because `1` sorts before `9`, and the comparison stops there. Inside
`(( ))` the C-style spellings are the numeric ones, which is the other reason to prefer it:
`>` means what it looks like, and it needs no quoting to keep the shell from reading it as a
redirection. [Conditionals and test](/scripting/conditionals-and-test/) has the rest of `[`
against `[[`.

## Integers, and nothing else

There are no floating-point numbers in bash arithmetic. Division truncates towards zero, with no
warning and no remainder:

```bash
used=7
total=9

echo "shell: $(( used * 100 / total ))%"
echo "awk:   $(awk -v u=$used -v t=$total 'BEGIN { printf "%.1f", u * 100 / t }')%"
```
```
shell: 77%
awk:   77.8%
```

Multiply before dividing, as that first line does, and integer arithmetic answers most
percentage and averaging questions well enough. When it does not, hand the sum to something that
does have floats. On Debian that is `awk`, because it is always installed:

```bash
command -v awk
command -v bc || echo "bc is not installed"
```
```
/usr/bin/awk
bc is not installed
```

Most examples on the internet use `bc`, which comes from a package of the same name that a base
Debian system does not have. A script calling it has to declare the dependency or check for it
first, and `awk` needs neither.

## A leading zero means octal

Inherited from C, and it bites here because `date` pads its output:

```bash
echo "octal:  $(( 010 + 1 ))"
echo "forced: $(( 10#010 + 1 ))"
bash -c 'month=08; echo "$(( month + 1 ))"'
echo "status: $?"
```
```
octal:  9
forced: 11
bash: line 1: 08: value too great for base (error token is "08")
status: 1
```

`010` is 8, so the first line is 9 rather than 11. `08` and `09` are not octal numbers at all and
fail outright, which is what happens to any script doing arithmetic on `$(date +%m)` during
August and September, and on `$(date +%d)` on the eighth and ninth of every month. `10#` forces
base ten and is the fix. `0x` is hexadecimal, and `base#number` works for anything from 2 to 64.

## A non-numeric value becomes zero

The failure mode to watch for, because it is silent:

```bash
count=abc
echo "arithmetic: $(( count + 1 ))"
bash -c 'count=abc; [ "$count" -eq 1 ]; echo "test status: $?"'
```
```
arithmetic: 1
bash: line 1: [: abc: integer expression expected
test status: 2
```

Inside `$(( ))`, a bare word is read as a variable name. `abc` is not set, an unset variable is
zero, so `abc + 1` is 1 and nothing is reported. `[ -eq ]` refuses the same value loudly, with
status 2 rather than 1 to distinguish "this is not a number" from "the comparison was false".
An unset variable behaves the same way, which is what `set -u` is for.

## Exercises

1. Round `7 / 2` up to 4 using integer arithmetic only.

   <details><summary>Answer</summary>

   ```bash
   echo "$(( (7 + 2 - 1) / 2 ))"
   ```

   Add one less than the divisor before dividing. The general form is
   `(( (a + b - 1) / b ))`, and it is the same trick as the `pages needed` line at the top of
   this page.
   </details>

2. A script reads `hour=$(date +%H)` and then fails once a day, at eight in the morning. Why?

   <details><summary>Answer</summary>

   `date +%H` pads to two digits, so at 08:00 it returns `08`. Any arithmetic on that is an
   invalid octal literal. Use `$(( 10#$hour ))`, or strip the zero with `${hour#0}`, which needs
   care of its own because `10` must not become `1`.
   </details>

3. Why does `if [ "$n" -gt 5 ]` print an error when `$n` is empty, while `if (( n > 5 ))` does
   not?

   <details><summary>Answer</summary>

   `[` receives two arguments where it expected three, since an unquoted empty variable would
   vanish and a quoted empty one is not a number either way. `(( ))` reads `n` as a variable name,
   finds it unset, and uses zero. One reports the problem and one hides it, and neither is what
   you meant: the fix is to default the value, with `${n:-0}`.
   </details>

## What's next

Arithmetic, arrays and parameter expansion between them cover what a script does with the values
it is holding. The remaining lessons are about the script as a running program:
[generating files with here-docs](/scripting/here-docs/), then
[cleaning up with `trap`](/scripting/traps-and-cleanup/), then the flags in `set -euo pipefail`
that `(( i++ ))` above has already given you one reason to be careful with.
