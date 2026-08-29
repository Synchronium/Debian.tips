---
title: "Traps and cleanup"
tagline: "mktemp, trap EXIT, and leaving nothing behind"
description: "The mktemp and trap EXIT pattern for scripts that clean up after themselves, why the trap body needs single quotes, and what set -e does not cover."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-29
order: 12
related: [exit-codes-and-error-handling, processes-and-signals, here-docs]
---

A script that creates a temporary file has to delete it, including on the paths where it does not
reach the end. `trap` registers a command to run when the shell exits, which turns that into two
lines at the top:

```bash
cat > job.sh <<'EOF'
#!/usr/bin/env bash
work=$(mktemp -p . work.XXXXXX)
trap 'rm -f "$work"' EXIT

echo "during the run: $(ls work.* | wc -l) temp file"
exit 3
EOF
chmod +x job.sh

./job.sh
echo "status: $?"
echo "after the run:  $(ls work.* 2>/dev/null | wc -l) temp files"
```
```
during the run: 1 temp file
status: 3
after the run:  0 temp files
```

`mktemp` creates the file and prints its name, atomically and with mode 600, which is what makes
it safe where `/tmp/myscript.$$` is not: a predictable name in a world-writable directory can be
created by somebody else first. `-p .` puts it in the current directory here so the example can
count it; a real script leaves it off and gets `$TMPDIR` or `/tmp`. `mktemp -d` makes a directory
instead, and pairs with `rm -rf`.

The exit status is untouched. The trap ran and the script still reported 3.

## EXIT fires however the script leaves

That is the whole reason to prefer it over deleting the file at the end:

```bash
bash -c 'trap "echo cleanup ran" EXIT; exit 3'
echo "normal exit:  $?"

bash -c 'trap "echo cleanup ran" EXIT; set -e; false; echo "not reached"'
echo "set -e abort: $?"
```
```
cleanup ran
normal exit:  3
cleanup ran
set -e abort: 1
```

The second script died in the middle, at a command it never expected to fail, and the cleanup
still happened. A `rm` written as the last line of the script would have been skipped, which is
how a failing cron job fills a disk over a month.

Signals are covered too, because a signal that terminates the shell reaches EXIT on the way out:

```bash
bash -c 'trap "echo cleanup ran" EXIT; kill -TERM $$; echo "not reached"'
```
```
cleanup ran
```

`echo "not reached"` never ran, and the cleanup did. An interactive shell adds a `Terminated`
line of its own here, reporting how the child died; that comes from the shell rather than from
the script. What signals do, and which of them can be caught at all, is
[Processes and signals](/concepts/processes-and-signals/). The part that belongs here is that
`EXIT` saves you from listing them.

## Quote the trap body with single quotes

The argument to `trap` is a string that the shell stores and evaluates later. Double quotes
expand it *now*, at the line where the trap is installed, which is usually before the variable it
names has a value:

```bash
cat > early.sh <<'EOF'
#!/usr/bin/env bash
trap "rm -f $work" EXIT
work=$(mktemp -p . tmp.XXXXXX)
EOF

cat > late.sh <<'EOF'
#!/usr/bin/env bash
trap 'rm -f "$work"' EXIT
work=$(mktemp -p . tmp.XXXXXX)
EOF

bash early.sh
echo "double-quoted trap left: $(ls tmp.* 2>/dev/null | wc -l)"
rm -f tmp.*

bash late.sh
echo "single-quoted trap left: $(ls tmp.* 2>/dev/null | wc -l)"
```
```
double-quoted trap left: 1
single-quoted trap left: 0
```

`early.sh` registered `rm -f ` with nothing after it, and ran that faithfully on exit. Nothing
errors and nothing warns, so the script looks correct until somebody checks `/tmp`. Move the trap
below the assignment and the double-quoted version happens to work, which is worse: it now
depends on line order, and the next person to add a second temp file will put it in the wrong
place.

## Catching Ctrl-C separately

`EXIT` is enough for cleanup. A separate `INT` or `TERM` trap is for saying something different
about an interrupted run, or for declining to be interrupted at a bad moment:

```bash
bash -c 'trap "echo interrupted" INT; kill -INT $$; echo "carried on"'
```
```
interrupted
carried on
```

A trapped signal does not end the script. If you want the interrupt to stop the run, the handler
has to say so with `exit`, and the convention is `exit 130` for INT and `exit 143` for TERM,
which is 128 plus the signal number. That convention is what
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/) reads back out.

Several signals can share one handler, `trap 'cleanup' INT TERM HUP`, and `trap - EXIT` removes a
trap again, which matters if a script hands off to something else and no longer wants to own the
cleanup.

## Exercises

1. Why is `trap 'rm -rf "$dir"' EXIT` dangerous when `dir` might be empty?

   <details><summary>Answer</summary>

   It is not, and that is the point of the quotes: `rm -rf ""` removes nothing. The dangerous
   version is unquoted, `trap "rm -rf $dir" EXIT`, which expands to `rm -rf ` at install time and
   then to `rm -rf /` the moment somebody appends a slash to it in a later edit. Quote the
   variable and single-quote the trap.
   </details>

2. A script traps `INT` to print a message, and Ctrl-C no longer stops it. What is missing?

   <details><summary>Answer</summary>

   An `exit` in the handler. A trapped signal runs the handler and then resumes the script at the
   point it was interrupted, which for a loop means the next iteration. `trap 'echo interrupted;
   exit 130' INT`.
   </details>

3. Where should the `trap` line go relative to `mktemp`?

   <details><summary>Answer</summary>

   Immediately after, and never before the variable is used for anything else. With a
   single-quoted trap body the order does not affect the result, since nothing is expanded until
   the trap fires, but a reader has to be able to see that the file and its cleanup were written
   together.
   </details>

## What's next

`set -e` has now come up twice, both times as something that does not do quite what it looks
like. [Debugging and robustness](/scripting/debugging-and-robustness/) is where it and the rest of
`set -euo pipefail` get read carefully.
