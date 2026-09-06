---
title: "Save everything a terminal session prints"
tagline: "tee for one command, script for the whole session"
description: "Keep a copy of what a command printed with tee, or record an entire terminal session with script, including the exit status trap that catches people out."
category: recipes
tags: [terminal, files, beginner]
updated: 2026-09-06
related: [tee, less, terminal-shell-and-tty, monitor-a-log-in-real-time]
---

**Problem:** You want a record of what happened in a terminal, either because somebody asked you
to send it or because you are about to break something and want to know what you did.

**Solution:**

For one command, `tee` writes the output to a file and to the screen at once:

```bash
wc -l data.txt | tee count.log
cat count.log
```
```
2 data.txt
2 data.txt
```

For a whole session, `script` records everything until you type `exit`:

```bash
script session.log
```

**How it works:**

`tee` sits in a pipeline and copies its input to a file and to standard output, so you still see
what you would have seen. Everything after it in the pipeline still works, which is why it goes in
the middle rather than at the end.

`script` is different in kind. It starts a new shell under a pseudo-terminal and records the whole
conversation: what you typed, what came back, and anything a program wrote straight to the terminal
rather than through a pipe. That last part is what `tee` cannot do, and it is why an installer or a
progress bar shows up in a typescript and vanishes from a pipeline.

The file `script` writes opens and closes with a line of its own:

<!-- verify: skip the timestamp is the moment you ran it and TERM is your terminal, and the replay has no terminal at all, so the line it would capture names none of what a reader sees -->
```
Script started on 2026-09-06 10:20:07+00:00 [COMMAND="..." TERM="xterm"]
```

Those lines are the record of when you started, not part of your session. `script -q` suppresses
the messages on screen and keeps them in the file.

**Variations:**

`tee` only receives standard output, so an error message goes past it to the terminal and never
reaches the file. Redirect stderr into the pipe first:

```bash
ls data.txt missing.txt 2>&1 | tee out.log >/dev/null
cat out.log
```
```
ls: cannot access 'missing.txt': No such file or directory
data.txt
```

The trailing `>/dev/null` throws away `tee`'s copy of the output, which is what you want when the
point is the file rather than the screen.

`tee -a` appends instead of truncating, so several commands can build one log:

```bash
wc -l data.txt | tee run.log >/dev/null
wc -c data.txt | tee -a run.log >/dev/null
cat run.log
```
```
2 data.txt
8 data.txt
```

Run a single command under `script` with `-c`, which is the form to use in a script of your own
since it needs nobody to type `exit`:

```bash
script -q -c 'wc -l data.txt' session.log >/dev/null
sed -n '2p' session.log
```
```
2 data.txt
```

> [!WARNING]
> Piping into `tee` changes what `$?` reports. The status you get back belongs to `tee`, which
> almost always succeeds, so a failing command in a pipeline that ends in `tee` looks like it
> worked.

```bash
false | tee out.log >/dev/null; echo "status: $?"
false | tee out.log >/dev/null; echo "PIPESTATUS: ${PIPESTATUS[0]}"
```
```
status: 0
PIPESTATUS: 1
```

`${PIPESTATUS[0]}` is the first command's own status and is a bash array, so it is not available in
`/bin/sh`. In a script that must catch the failure, `set -o pipefail` makes the pipeline report the
first non-zero status instead, which is the answer
[exit codes and error handling](/concepts/exit-codes-and-error-handling/) recommends and the one
worth reaching for by default.

A typescript records the control characters a program sent, so colour codes and the redrawing a
progress bar does are in the file and look like noise. `col -b` strips most of them, and
`cat -v` shows what is there before you decide. Where the recording is for a person rather than a
machine, `script -q` plus a command that does not colour its output is the shorter path.
