---
title: "xargs"
tagline: "Build command lines from standard input"
description: "Tested xargs examples: batching with -n, placeholders with -I, NUL-separated input from find -print0, parallel runs with -P, and what its exit codes mean."
category: commands
tags: [scripting, processes, files]
updated: 2026-08-23
tier: flagship
related: [find, grep, wc, pipes-and-redirection]
---

Most commands take their input as arguments, not on standard input. `rm`, `cp`, `chmod`, `kill`
and `mkdir` all ignore whatever you pipe into them, so `find logs -name "*.log" | rm` doesn't
delete anything and complains that it is missing an operand. This is because the pipeline
delivered those filenames to `rm`'s standard input, which `rm` never reads. `xargs` sits in that
gap. It reads items from standard input and runs a command with those items appended as arguments.

With no command given it runs `echo`, which is the quickest way to see what it is about to pass
on before you let it near something destructive.

## How input becomes arguments

By default `xargs` splits its input on whitespace (spaces, tabs and newlines alike) and packs as
many items as will fit onto one command line. Four hostnames become a single command with four
arguments rather than four separate commands. `-n1` forces one item per run, `-n3` takes three at
a time, and `-L1` splits on input lines instead of on a count of items.

The packing is worth understanding because it is usually where the speed comes from. One `grep`
invocation given 500 filenames does far less work than 500 invocations given one filename each,
and on a large tree that difference is minutes rather than milliseconds. It is also why `-s`
exists: the kernel caps how long a single command line may be, so `xargs` splits into as many
runs as it needs to stay under that cap. You will not hit the limit by hand, but you will hit it
piping a large [`find`](/commands/find/) into a command, and `xargs` handles it silently.

## Whitespace separates items, including whitespace inside filenames

A file called `last week.log` arrives as two items, `last` and `week.log`, so the command runs
against two names that do not exist. The failure is a quiet one: `wc -l` reports
counts for every file it could open, prints an error for the two it could not, and puts a total at
the bottom that is simply wrong. Read quickly, it looks like a successful run.

The fix is to separate items with a byte that cannot appear in a filename. `find -print0` ends
each name with a NUL, and `xargs -0` splits on NUL instead of whitespace. [`grep`](/commands/grep/)
has `-Z`, `sort` has `-z`, and `du` has `--files0-from`, so the whole pipeline can speak the same
protocol end to end.

`-0` turns off one other behaviour worth knowing about: without it, `xargs` treats quotes and
backslashes in its input as syntax. A filename containing an apostrophe makes it fail outright
with `unmatched single quote`. That failure is at least visible, unlike the silent splitting
above. `-0` reads bytes literally and takes neither quotes nor backslashes as special.

## Putting the item somewhere other than the end

Everything so far appends items to the end of the command, which is where most commands want their
filenames. [`cp`](/commands/cp/) does not: its destination has to come last, which is exactly
where `xargs` puts the items. `xargs cp` builds `cp file1 file2 file3`, and `cp` reads that last
name as the destination directory, failing with `target 'file3': Not a directory`. `cp -t` and
`mv -t` exist for this, naming the destination up front.

`-I` solves that by naming a placeholder. Every occurrence of that placeholder in the command is
replaced with the incoming item, wherever it appears:

```sh
xargs -I{} cp {} /backup/{}.bak
```

`{}` is only a convention. `-I@` works the same way, and so can be a better choice when the
command itself contains braces.

`-I` changes two other things at the same time, which are both easy to miss. It runs the command
once per **line** of input rather than packing several items into one command line, so the
batching described above is gone and a thousand items mean a thousand processes. It also overrides
`-n`. If you give both, `xargs` will warn that it is ignoring the `-n`.

### Placeholders inside `sh -c`

Wrapping the command in `sh -c` is how you get shell features that `xargs` has none of, such as a
pipeline or a variable. The trap is that `-I` substitutes **text**, and it does so before that
shell parses anything. So this:

```sh
xargs -0 -I{} sh -c 'cat {}'
```

builds the command line `sh -c 'cat logs/last week.log'`, so the child shell splits that on the
space into two arguments. The `-0` protected the filename all the way through `xargs` and then
handed it to a shell that undoes the protection.

Pass the item as an argument instead of pasting it into the script, and quote it where it is used:

```sh
xargs -0 -I{} sh -c 'echo "== $1"; cat "$1"' _ {}
```

Everything after the quoted script is passed to that shell as positional parameters. The first one
becomes `$0`, which is conventionally the program name and not usually wanted, so `_` absorbs it
and the real item arrives as `$1`. Quoting `"$1"` then keeps it in one piece however many spaces
it contains.

## Running several commands at once

`-P4` runs up to four of the commands concurrently, and `-P0` runs as many as the system will
allow. This is a real speed-up for anything I/O-bound, and it comes with the usual condition:
output from concurrent runs interleaves in whatever order the runs finish, so anything you intend
to read or compare needs sorting afterwards. Commands that append to a shared file are not safe
this way at all.

## Exit status

`xargs` reports on the batch rather than on any one command. If a command it ran exits non-zero,
`xargs` exits `123` whatever the command's own status was. A command exiting `255` is treated as a
demand to stop immediately: `xargs` abandons the remaining input and exits `124`. A script
checking `$?` after an `xargs` pipeline sees those numbers rather than the ones its command
produced.

Empty input is a case worth guarding against. Given nothing at all, `xargs` still runs the
command once with no arguments, which for `rm` is harmless and for something like `docker rm` is
not. `-r`
(`--no-run-if-empty`) suppresses that run. It is a GNU extension rather than POSIX, so a script
that has to be portable checks for empty input itself. See
[pipes and redirection](/concepts/pipes-and-redirection/) for how the pipeline delivers that input
in the first place.
