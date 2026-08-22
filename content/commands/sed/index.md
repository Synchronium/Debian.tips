---
title: "sed"
tagline: "Edit text streams with a single pass, line by line"
description: "Tested sed examples: substitution, addressing, deletion, in-place editing, and multi-command scripts."
category: commands
tags: [text-processing, regex]
updated: 2026-08-22
tier: flagship
related: [grep, awk, tr, diff, pipes-and-redirection, exit-codes-and-error-handling]
---

`sed` (**s**tream **ed**itor) reads input one line at a time, applies a script of editing
commands to each line, and prints the result. Where [`grep`](/commands/grep/) decides which lines
to show, `sed` changes them: substitute text, delete lines, insert new ones, without opening an
editor or writing a program.

## Why every command runs once per line

For each input line, `sed` copies it into a working buffer called the **pattern space**, runs your
whole script against that buffer, then, unless told otherwise, prints the pattern space and moves
to the next line. That read-script-print loop is the cycle.

Every command in your script therefore runs once per line. `s/foo/bar/` does not mean "replace foo
with bar in the file"; it means "replace foo with bar in the line currently in the pattern space".

## Substitution: `s/pattern/replacement/flags`

The workhorse command, and the one most people mean when they say "sed":

```bash
sed "s/ERROR/CRITICAL/" app.log        # first match per line
sed "s/ERROR/CRITICAL/g" app.log       # every match per line (g = global)
```

Without `g`, only the first match on each line is replaced, which accounts for most of the "why
didn't that replace everything" questions. The `/` delimiters are conventional rather than
mandatory: if the pattern or replacement is full of literal slashes, pick a different one.
`s#/etc/app#/opt/app#` reads far better than escaping every `/`.

## Addressing: which lines a command applies to

Every command can be prefixed with an **address** restricting it to specific lines:

```bash
sed -n "2p" file            # just line 2
sed -n "2,4p" file          # lines 2 through 4
sed -n "/ERROR/p" file      # lines matching a regex
sed "/DEBUG/d" file         # delete lines matching a regex
sed "1!d" file              # everything EXCEPT line 1 ('!' negates)
```

`-n` suppresses the default auto-print, which is why it pairs with `p`. Without it, `sed "2p"`
prints line 2 twice: once from `p`, once from the automatic print. GNU `sed` also supports a
`first~step` address (`1~2` is every odd line) that POSIX `sed` doesn't have.

## BRE by default, ERE with `-E`

Plain `sed` uses BRE, where `+`, `?`, `|`, and `()` need backslash-escaping to mean anything
special. `-E` (or `-r` on some systems) switches to ERE, letting you write
`s/([a-z]+),([0-9]+)/\2:\1/` instead of the backslash-heavy BRE equivalent. Same tradeoff as
[grep](/commands/grep/): reach for `-E` the moment your pattern needs grouping or alternation.

## Rewriting a file instead of printing

`-i` rewrites the file directly instead of printing to stdout. `-i.bak` does the same thing but
keeps a backup of the original with `.bak` appended to the name first.

> [!WARNING]
> `-i` with no suffix overwrites the original with no backup at all. Test your script with
> `-i.bak` (or no `-i`, just reading the printed output) before dropping the safety net.

To see what an edit would change rather than reading the whole file, pipe the result into
[`diff`](/commands/diff/) against the original: `sed "s/ERROR/CRITICAL/g" app.log | diff app.log -`
prints only the lines that differ, and prints nothing at all when the script matched nothing.

## The hold space: carrying data between lines

`sed` has a second buffer, the **hold space**, which persists across cycles. `h` copies the pattern
space into it, `H` appends instead, `g` and `G` copy back the other way, and `x` swaps the two.
That is enough to reverse a file, join consecutive lines, or print the line before a match.

When a script starts wanting state that survives from one line to the next, the hold space is
where `sed` keeps it. It is also the point at which an [`awk`](/commands/awk/) script is often the
better tool.

## Chaining multiple commands

Separate commands with `;`, repeat `-e` once per command, or put them one per line in a script
file loaded with `-f script.sed`. All three are equivalent. `-e`/`-f` matter mainly when a
command itself contains a `;` your shell would otherwise interpret.
