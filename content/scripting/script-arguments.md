---
title: "Script arguments"
tagline: "Positional parameters, \"$@\" versus \"$*\", and getopts"
description: "How a script reads what it was called with: positional parameters, why \"$@\" and \"$*\" are not the same, shift, and parsing real flags with getopts."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-18
order: 5
related: [loops, variables-and-quoting, exit-codes-and-error-handling]
---

A script receives its arguments as numbered variables. `$1` is the first, `$2` the second, and so
on; `$0` is the script's own invocation path, and `$#` counts the arguments without including
`$0`.

```bash
./args.sh one "two three"
```
```
count: 2
at: [one]
at: [two three]
star: [one two three]
```

That is `args.sh`:

```bash
#!/usr/bin/env bash
echo "count: $#"
for a in "$@"; do echo "at: [$a]"; done
for a in "$*"; do echo "star: [$a]"; done
```

Two arguments went in, and the two loops disagree about how many there were.

## `"$@"` is almost always the one you want

`"$@"` expands to each argument as its own word, keeping any spaces inside an argument. `"$*"`
joins them all into a single word separated by spaces. In the output above, `"$@"` gave two
iterations and preserved `two three` as one argument, while `"$*"` gave one iteration containing
everything.

Unquoted, both behave the same and both are wrong: `$@` and `$*` are each split on whitespace, so
`two three` becomes two arguments and the original grouping is lost for good. Write `"$@"` when
passing arguments on to another command, and `"$*"` only when you genuinely want one string,
usually to print it.

The positional parameters are an [array](/scripting/arrays/) with a fixed name, and `"${arr[@]}"`
against `"${arr[*]}"` is this same pair of rules written out in full.

```bash
# Forwarding arguments to another command, correctly
grep "$pattern" "$@"
```

> [!WARNING]
> `"$@"` and `$@` differ in a way that only shows up once an argument contains a space, which is
> usually in production rather than in testing. A script called with `./backup.sh "My Documents"`
> works with `"$@"` and silently backs up two nonexistent directories with `$@`. This is the same
> rule as [Variables and quoting](/scripting/variables-and-quoting/), applied to the arguments a
> script was handed.

## `shift` moves the window along

`shift` discards `$1` and renumbers everything after it, which is how you consume arguments one at
a time:

```bash
./shifty.sh a b c
```
```
first: a
after shift, first: b
remaining count: 2
```

```bash
#!/usr/bin/env bash
echo "first: $1"
shift
echo "after shift, first: $1"
echo "remaining count: $#"
```

`shift n` drops `n` of them at once. Shifting more arguments than exist is an error, so a loop
that shifts should test `$#` rather than assuming.

## Defaults and required arguments

`${1:-default}` supplies a value when the caller did not:

```bash
./deploy.sh
```
```
deploying to staging
```

```bash
#!/usr/bin/env bash
target="${1:-staging}"
echo "deploying to $target"
```

When an argument is genuinely required, say so and exit non-zero rather than carrying on with an
empty string:

```bash
./needs-arg.sh
```
```
usage: ./needs-arg.sh <name>
```

The message goes to stderr and the exit status is `2`, both conventions worth keeping; see
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/) for why a script that
fails silently is worse than one that fails loudly.

## `getopts` for real flags

Hand-rolling flag parsing with `case` works until someone passes `-vn name` or `--`. `getopts` is
built in, handles grouping and `OPTARG`, and is a few lines:

```bash
./greet-flags.sh -v -n deb1 extra
```
```
verbose=1 name=deb1 remaining=extra
```

```bash
#!/usr/bin/env bash
verbose=0
name=""
while getopts "vn:" opt; do
  case "$opt" in
    v) verbose=1 ;;
    n) name=$OPTARG ;;
    *) echo "usage: $0 [-v] [-n name]" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
echo "verbose=$verbose name=$name remaining=$*"
```

The option string `"vn:"` says `-v` is a flag and `-n` takes a value, the colon being what marks
the difference. `shift $((OPTIND - 1))` is not optional: `getopts` leaves `OPTIND` pointing at the
first non-option argument, and without the shift, `"$@"` still contains the flags you just parsed.

An unrecognised flag falls to the `*` branch:

```bash
./greet-flags.sh -q
```
```
./greet-flags.sh: illegal option -- q
usage: ./greet-flags.sh [-v] [-n name]
```

The first line is `getopts` itself complaining, the second is yours. Silence it with a leading
colon in the option string (`":vn:"`) if you would rather report errors entirely in your own
words.

`getopts` handles single-dash options only. Long options like `--verbose` need `getopt` (a
different, external program) or a hand-written `while`/`case` loop, and for most scripts the short
forms are enough.

## Exercises

1. Write a script that prints each argument on its own line, numbered, handling arguments with
   spaces.

   <details><summary>Answer</summary>

   ```bash
   #!/usr/bin/env bash
   n=1
   for a in "$@"; do
     echo "$n: $a"
     n=$((n + 1))
   done
   ```

   `"$@"` is what keeps an argument containing spaces as one iteration.
   </details>

2. A script takes a required source and an optional destination defaulting to `/tmp`. Write the
   first three lines.

   <details><summary>Answer</summary>

   ```bash
   #!/usr/bin/env bash
   src="${1:?usage: $0 <source> [destination]}"
   dest="${2:-/tmp}"
   ```

   `${1:?message}` prints the message to stderr and exits non-zero when `$1` is unset, which is
   the terse form of the explicit `if [ $# -eq 0 ]` check. `${2:-/tmp}` supplies the default
   without assigning it.
   </details>

3. Why does a `getopts` loop need `shift $((OPTIND - 1))` afterwards?

   <details><summary>Answer</summary>

   Because `getopts` does not remove the options it parsed. It only records how far it got, in
   `OPTIND`. Without the shift, the positional parameters still start at `-v`, so any later
   `"$@"` re-processes the flags as if they were filenames.
   </details>

## What's next

[Functions](/scripting/functions/) come next: defining them, what `return` does that `exit` does
not, and why `local` is the difference between a helper and a landmine.
