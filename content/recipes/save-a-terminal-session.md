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
what you would have seen. Everything downstream of it still works, so it belongs in the middle of a
pipeline rather than at the end.

`script` is different in kind. It starts a new shell under a pseudo-terminal and records the whole
conversation: what you typed, what came back, and anything a program wrote straight to the terminal
instead of through a pipe. `tee` never sees that third category, which is why an installer or a
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

The trailing `>/dev/null` throws away `tee`'s copy of the output. Use it when you want the file and
not the screen.

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

`script -c` runs a single command and exits, so it needs nobody to type `exit` and can be used
inside a script of your own:

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

`${PIPESTATUS[0]}` is the first command's own status. It is a bash array, so it is not available in
`/bin/sh`. In a script that must catch the failure, `set -o pipefail` makes the pipeline report the
first non-zero status instead, and
[exit codes and error handling](/concepts/exit-codes-and-error-handling/) sets out its exceptions.

A typescript keeps every control character a program sent, so colour codes and the cursor movements
behind a progress bar all end up in the file looking like noise. `cat -v` shows what is there and
`col -b` strips most of it. For a recording somebody is going to read, the shorter path is
`script -q` and a command that does not colour its output.
