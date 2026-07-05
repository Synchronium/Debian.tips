---
title: "Exit codes and error handling"
description: "How $?, PIPESTATUS, set -e, and pipefail combine to tell a script what actually succeeded or failed, and where each one falls short."
category: concepts
tags: [scripting, beginner]
updated: 2026-07-05
related: [pipes-and-redirection, grep, curl]
---

You've written `command && echo ok || echo fail` without thinking much about it. Here's what
`$?` actually is, why a pipeline can hide a failure from you, and what `set -e` does and doesn't
protect against.

## Every command returns a number, not just output

When any command finishes, it sets an **exit status**: an integer from 0 to 255, stored until
the next command runs, readable via `$?`. Convention, not enforcement, says `0` means success and
anything else means some kind of failure:

```bash
true; echo $?
false; echo $?
```
```
0
1
```

`$?` only holds the *most recent* command's status. Check it immediately, or save it to a
variable, before running anything else, including an `echo` you might think is "free":

```bash
grep -q "error" app.log
status=$?
echo "grep exited $status"
```

## Specific numbers carry specific meanings

Beyond the generic 0/non-zero split, a handful of exit codes are conventional across most Unix
tools:

```bash
nonexistent-command-xyz
echo "exit=$?"
```
```
bash: nonexistent-command-xyz: command not found
exit=127
```

```bash
chmod 644 noexec.sh
./noexec.sh
echo "exit=$?"
```
```
bash: ./noexec.sh: Permission denied
exit=126
```

`127` means the shell couldn't find the command at all. `126` means it found it but couldn't
execute it, commonly a missing execute bit (see
[File permissions explained](/concepts/file-permissions-explained/)). Signals add another
pattern: a process killed by signal *N* exits with `128 + N`. `kill -TERM` on a running command
produces exit status `143` (128 + 15); Ctrl-C, which sends `SIGINT` (signal 2), produces `130`.
Recognising these numbers tells you whether a script died from its own logic or was killed from
outside.

## A pipeline's exit status is the last command's, by default

```bash
false | true
echo $?
```
```
0
```

Only `true`'s exit status survives; `false`'s failure earlier in the pipe is invisible to `$?`.
This is the single most common way a script's error handling misses a real failure: piping a
command that might fail into `grep`, `sort`, or anything else silently discards its exit code.

Two ways to see every stage's exit status instead of just the last one:

```bash
false | true
echo "${PIPESTATUS[@]}"
```
```
1 0
```

`PIPESTATUS` is a bash array holding the exit status of every command in the most recently run
pipeline, in order. Alternatively, `set -o pipefail` changes what `$?` itself reports for a
pipeline: the exit status of the last command that failed, or `0` if all of them succeeded.

```bash
bash -c 'set -o pipefail; false | true; echo $?'
```
```
1
```

Most scripts benefit from `pipefail` turned on near the top; without it, a pipeline is only as
reliable as its last stage.

## `set -e`: stop on the first failure, with real exceptions

`set -e` (`errexit`) makes a script exit immediately when a command fails, instead of continuing
to the next line:

```bash
set -e
echo before
false
echo after
```
```
before
```

`after` never prints; the script stopped at `false`. But `set -e` has well-known blind spots:
a command's failure is *not* fatal when it's part of a condition (`if`, `while`, `until`), the
left side of `&&`/`||`, or negated with `!`:

```bash
set -e
if false; then echo yes; fi
echo "still running"
```
```
still running
```

Here `false` "fails" but the script keeps going, because `false` is being *tested*, not run for
its own sake. This is correct and necessary (otherwise no script using `set -e` could ever check
whether a command succeeds without aborting), but it means `set -e` alone is not a substitute for
actually checking exit codes where they matter.

## Reacting to a failure without aborting: traps

```bash
trap 'echo caught error, exit=$?' ERR
false
echo done
```
```
caught error, exit=1
done
```

`trap ... ERR` runs a command whenever any command in the script exits non-zero (subject to the
same exceptions `set -e` has), useful for logging, cleanup, or alerting without hand-checking
`$?` after every single line.

## `&&` and `||`: short-circuit on exit status

```bash
true && echo "ran because true succeeded"
false || echo "ran because false failed"
```

`&&` runs its right side only if the left side exited `0`; `||` runs its right side only if the
left side exited non-zero. Chains of these are exit-status logic, not boolean logic on output;
this is the mechanism behind idioms like `mkdir -p "$dir" && cd "$dir"` and `command -v jq ||
echo "jq not installed"`.

## Common misconceptions

- **"A pipeline's exit status reflects whether the whole thing worked."** Only with
  `pipefail` set. Otherwise it's just the last command's status, as shown above.
- **"`set -e` makes a script bulletproof."** It stops on unguarded failures, but conditions,
  negation, and the left side of `&&`/`||` are deliberately exempt, and a failing command
  inside a function called from a context that doesn't check its return can still slip through.
- **"Any non-zero exit means the same kind of failure."** `1` (generic failure), `126`
  (not executable), `127` (not found), and `128+N` (killed by signal *N*) mean different things.
  Treating them identically in a script's error handling throws away information the shell
  already computed for you.
- **"I need `$?` right after the command, or I've lost it."** True, and worth restating: any
  command at all, including one you think of as a no-op like `echo` or `[[ ... ]]`, overwrites
  `$?`. Capture it into a variable the moment you need it for anything other than an immediate
  check.
