---
title: "sed"
tagline: "Edit text streams with a single pass, line by line"
description: "Tested sed examples: substitution, addressing, deletion, in-place editing, and multi-command scripts."
category: commands
tags: [text-processing, regex]
updated: 2026-07-05
tier: flagship
related: [grep, exit-codes-and-error-handling]
---

`sed` (**s**tream **ed**itor) reads input one line at a time, applies a script of editing
commands to each line, and prints the result. Where [`grep`](/commands/grep/) only decides
*which* lines to show, `sed` decides how to *transform* them: substitute text, delete lines,
insert new ones, all without opening an editor or writing a program.

## The mental model: the pattern space and the cycle

For each input line, `sed` copies it into a working buffer called the **pattern space**, runs
your whole script against that buffer, then (unless told otherwise) prints the pattern space and
moves to the next line. This read-script-print loop is the "cycle." Almost every confusing `sed`
behaviour makes sense once you remember every command in your script runs *once per line*, not
once for the whole file. `s/foo/bar/` inside a script isn't "replace foo with bar in the file,"
it's "replace foo with bar in *whatever line I'm looking at right now*."

## Substitution: `s/pattern/replacement/flags`

The workhorse command, and the one most people mean when they say "sed":

```bash
sed "s/ERROR/CRITICAL/" app.log        # first match per line
sed "s/ERROR/CRITICAL/g" app.log       # every match per line (g = global)
```

Without `g`, only the *first* match on each line is replaced, a constant source of "why didn't
this replace everything" confusion. The `/` delimiters are conventional, not mandatory: if your
pattern or replacement contains a lot of literal slashes (paths are the classic case), pick a
different delimiter. `s#/etc/app#/opt/app#` reads far better than escaping every `/`.

## Addressing: deciding which lines a command applies to

Every command can be prefixed with an **address** restricting it to specific lines:

```bash
sed -n "2p" file            # just line 2
sed -n "2,4p" file          # lines 2 through 4
sed -n "/ERROR/p" file      # lines matching a regex
sed "/DEBUG/d" file         # delete lines matching a regex
sed "1!d" file              # everything EXCEPT line 1 ('!' negates)
```

`-n` suppresses the default auto-print, which is why it pairs so naturally with `p`. Without
`-n`, `sed -n "2p"` would print line 2 *twice* (once from `p`, once from the automatic print).
GNU `sed` also supports a `first~step` address (`1~2` = every odd line) that POSIX `sed` doesn't
have.

## Basic regular expressions by default: same trap as grep

Plain `sed` uses BRE, where `+`, `?`, `|`, and `()` need backslash-escaping to mean anything
special. `-E` (or `-r` on some systems) switches to ERE, letting you write
`s/([a-z]+),([0-9]+)/\2:\1/` instead of the backslash-heavy BRE equivalent. Same tradeoff as
[grep](/commands/grep/): reach for `-E` the moment your pattern needs grouping or alternation.

## Editing files in place

`-i` rewrites the file directly instead of printing to stdout. `-i.bak` does the same thing but
keeps a backup of the original with `.bak` appended to the name first.

> [!WARNING]
> `-i` with no suffix overwrites the original with no backup at all. Test your script with
> `-i.bak` (or no `-i`, just reading the printed output) before dropping the safety net.

## Beyond one line: the hold space

`sed` also has a second buffer, the **hold space**, that persists across cycles. Commands like
`h` (copy pattern space to hold space), `H` (append instead of copy), `g`/`G` (copy back the
other way), and `x` (swap the two) let a script remember something from an earlier line and use
it later (reversing a file, joining consecutive lines, printing a line before a match). It's
a small toolkit, but it's the reason `sed` can do more than pure per-line substitution. Reach
for it when a single-pass `awk` script starts feeling more natural than a `sed` one-liner, since
that's usually the sign the hold space is what you actually need.

## Chaining multiple commands

Separate commands with `;`, repeat `-e` once per command, or put them one per line in a script
file loaded with `-f script.sed`. All three are equivalent. `-e`/`-f` matter mainly when a
command itself contains a `;` your shell would otherwise interpret.
