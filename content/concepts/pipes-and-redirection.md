---
title: "Pipes and redirection"
tagline: "Rewiring three file descriptors before the program runs"
description: "How | connects commands together, and how >, >>, 2>&1, and <() route data to and from files, other commands, and each other."
category: concepts
tags: [terminal, one-liners, beginner]
updated: 2026-08-22
related: [grep, sed, exit-codes-and-error-handling, sort, uniq]
---

Pipes and redirection both work by rewiring the file descriptors a process starts with, before
the program runs, which is why the order of `2>&1` in a command changes what it does.

## The three file descriptors

Every process on Linux starts with three open file descriptors: **standard input** (fd 0),
**standard output** (fd 1), and **standard error** (fd 2). By default, stdin reads from your
keyboard and stdout/stderr both write to your terminal. Pipes and redirection don't change how a
program reads or writes. They rewire where those three numbered descriptors point, before the
program ever starts.

A program like `grep` doesn't know or care whether fd 1 is your terminal, a file, or another
program's fd 0. It writes to "file descriptor 1" and lets whatever's plumbed into that number
handle the rest.

## The pipe: `|`

A pipe connects one command's stdout directly to the next command's stdin:

```bash
ls -l | grep ".log"
```

`ls -l` never knows its output is going to `grep` instead of your screen; it just writes to
fd 1 as always. The shell creates an actual OS-level pipe (a small in-memory buffer) and hands
one end to `ls` as its stdout and the other to `grep` as its stdin.

> [!NOTE]
> Piping only connects stdout, not stderr. If a command's error messages seem to vanish into the
> pipe unread, they're still going straight to your terminal. See "combining stdout and
> stderr" below for piping both.

Chains of pipes work the same way, one connection at a time: `cat access.log | sort | uniq -c |
sort -rn` is three separate pipes, each wiring one command's stdout to the next command's
stdin. See [sort](/commands/sort/) and [uniq](/commands/uniq/) for what those stages do. Nothing
about the last stage is special either: any command that reads stdin can take that position,
whether it is [`wc`](/commands/wc/) counting the result or [`cowsay`](/commands/cowsay/)
announcing it.

## Redirecting to and from files

```bash
grep "error" app.log > errors.txt   # overwrite errors.txt with stdout
grep "error" app.log >> errors.txt  # append instead of overwrite
sort < names.txt                    # read stdin from a file instead of the keyboard
grep "error" app.log 2> /dev/null   # discard stderr
```

`>` truncates the target file first. If `errors.txt` already had content, it's gone the moment
the redirected command starts, even before it writes anything. `>>` skips the truncation and
appends. `2>` redirects file descriptor 2 (stderr) specifically; plain `>` (or `1>`) redirects
only fd 1 (stdout). The two are independent unless you explicitly connect them.

## Combining stdout and stderr, and why order matters

`2>&1` means "make fd 2 point wherever fd 1 currently points," not "merge them from now on."
Redirections are applied **left to right**, so where you put `2>&1` relative to a file
redirection changes the outcome entirely:

```bash
{ echo out; echo err >&2; } > both.log 2>&1
cat both.log
```
```
out
err
```

Here, `> both.log` runs first, so fd 1 now points at the file, and `2>&1` then makes fd 2 point
at whatever fd 1 points to right now: the file. Both streams end up in `both.log`.

```bash
{ echo out; echo err >&2; } 2>&1 > both.log
cat both.log
```
```
err
out
```

Reversed, `2>&1` runs first, while fd 1 still points at the terminal, so fd 2 gets pointed at the
terminal. *Then* `> both.log` redirects fd 1 to the file. Read that output in the order it was
printed: `err` appeared straight away, on the terminal, because fd 2 had already locked in "the
terminal" as its target before fd 1 moved. `out` appeared only when `cat` read it back out of the
file. Bash also provides `&>` as a shorthand for "redirect both stdout and stderr to this file,"
sidestepping the ordering question when that is the behaviour you want.

## Process substitution: `<(...)`

Some commands (like `diff`) want two *files* to compare, not two streams to read in sequence.
Process substitution runs a command and presents its output as if it were a file:

```bash
diff <(echo -e "a\nb\nc") <(echo -e "a\nx\nc")
```
```
2c2
< b
---
> x
```

Bash runs each command, connects its output to a temporary file-like path (often
`/dev/fd/63`-style), and substitutes that path into the command line, so
[`diff`](/commands/diff/) compares two live command outputs without either one ever touching disk
as a real file.

## Heredocs and here-strings

A heredoc feeds multiple lines of literal text to a command's stdin, with variable expansion
still active:

```bash
cat <<EOF
Line one
Line two: $(whoami)
EOF
```
```
Line one
Line two: user
```

The `$(whoami)` was expanded by the shell before `cat` ever saw it. The quoted `<<'EOF'` form
passes every line through untouched instead.

A here-string (`<<<`) is the single-line version: `cat <<< "some text"` feeds that one string in
as stdin, without the multi-line `<<EOF ... EOF` ceremony.

## `tee`: splitting one stream into two

Redirection routes a stream to *one* destination. When you want a stream to go to a file *and*
still show up on screen, common when watching a long-running command's output while also
keeping a log, pipe it through `tee`:

```bash
some-long-command | tee output.log
```

`tee` reads stdin, writes an unmodified copy to both stdout and the named file, and the pipeline
continues from there if there's more after it. The [tee](/commands/tee/) page covers the rest,
including why `sudo echo x > /etc/file` fails and `tee` is the fix.

## Common misconceptions

- **"Piping connects everything."** It connects stdout to stdin, full stop. Errors, exit codes,
  and anything written directly to a file descriptor other than 1 or read from anywhere other
  than 0 are unaffected by a `|`.
- **"`2>&1` always means combine them."** It means "point fd 2 at fd 1's *current* target": a
  snapshot at that moment in the command line, not an ongoing link.
- **"`>` and `>>` are interchangeable if the file doesn't exist yet."** True only in that one
  case. The moment the file exists, `>` silently discards its previous contents, which is a
  common way to accidentally lose a log file that took hours to accumulate.
- **A pipeline's exit status is usually the *last* command's**, not the first one that might have
  failed silently upstream. See
  [Exit codes and error handling](/concepts/exit-codes-and-error-handling/) for `PIPESTATUS` and
  `set -o pipefail`, which fix exactly this gap.

## Composing small commands

Small, single-purpose commands become useful once you can chain them arbitrarily.
[`ps aux | grep nginx`](/commands/ps/), `cat access.log | sort | uniq -c | sort -rn`: each is a
short pipeline of commands that individually do very little, connected by `|` and occasionally a
file redirection. Reading one left to right, a descriptor rewire at a time, is most of what
separates copying commands off the internet from building the pipeline you need.
