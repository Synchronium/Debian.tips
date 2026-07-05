---
title: "grep"
tagline: "Search text with patterns"
description: "80+ tested grep examples: recursive search, regex flavours, context lines, counting, scripting, and more."
category: commands
tags: [search, regex, text-processing]
updated: 2026-07-05
tier: flagship
related: [find, sed, pipes-and-redirection, exit-codes-and-error-handling]
---

`grep` searches its input, one or more files, or whatever's piped to it, for lines that match
a pattern, and prints those lines. It's the tool you reach for whenever you know roughly what
you're looking for but not where it lives: which log line mentioned the failed request, which
source file still has a `TODO`, which config line sets the timeout.

## The mental model: one line in, one line out

`grep` reads its input **line by line**. For each line, it tests the pattern; if the line
matches, it prints the whole line (by default) and moves on. It never looks across lines unless
you explicitly ask it to (`-A`/`-B`/`-C` for context, `-z` for NUL-separated input). This is why
`grep` is fast on huge files and why it composes so naturally in a pipeline. Like every classic
Unix tool, it does one thing to a stream and lets the next command in the pipeline do the rest.

Two numbers matter when you're using `grep` in a script rather than reading its output yourself:
**exit status** (`0` if something matched, `1` if nothing matched, `2` on an actual error) and
**line count** (`-c`). Both let you skip printing anything at all; see the scripting section
below.

## Three regex flavours, one command

`grep`'s biggest source of confusion is that it supports three different pattern languages,
selected by flag:

- **Basic regular expressions (BRE)**, the default. `+`, `?`, `|`, and `()` are *literal
  characters* unless you backslash-escape them (`\+`, `\?`, `\|`, `\(\)`).
- **Extended regular expressions (ERE)**, enabled with `-E` (or run `egrep`, which is
  equivalent but deprecated). `+`, `?`, `|`, and `()` work the way you'd expect from most other
  languages, unescaped. If you're writing anything beyond the simplest literal search, reach for
  `-E`. It's one flag and it saves you from a backslash minefield.
- **Fixed strings**, enabled with `-F` (or run `fgrep`). No regex at all: every character in
  the pattern is literal. Use this when your search term might contain regex metacharacters
  you *don't* want interpreted (a literal `.`, `[`, or `*`). It's also measurably faster on
  very large inputs, since there's no regex engine involved.

GNU grep adds a fourth, non-POSIX option: **`-P`** for Perl-compatible regular expressions,
which unlocks lookahead/lookbehind (`(?<=...)`, `(?=...)`) and other features BRE/ERE don't
have. It's not portable to non-GNU greps (BSD, busybox), so treat it as a last resort for things
ERE genuinely can't express.

> [!TIP]
> If you find yourself escaping lots of parentheses and pipes, that's the signal to add `-E` and
> write the regex the way you'd expect.

## What "matching" actually prints

By default `grep` prints the *whole matching line*, not just the matched text. This surprises
people used to regex functions in programming languages that return only the match. To get
just the matched substring, add `-o`. To get neither the line nor the match, just a count or a
yes/no, use `-c` or `-q`.

When you search multiple files, `grep` prefixes each line with the filename automatically
(`-H` forces this even for a single file; `-h` suppresses it even for multiple files). This is
why `grep -r "TODO" .` output is more useful than piping `find` through a single-file `grep`
would be.

## grep vs sed vs awk

All three read text line by line, but they answer different questions. `grep` answers "*which*
lines match?" and prints lines verbatim. [`sed`](/commands/sed/) answers "how do I *transform*
matching lines?" `awk` answers "how do I pull *fields* out of matching lines and compute
something?" A common pattern is chaining them: `grep` to find the relevant lines, then `awk` or
`cut` to pull out a field, then `sort | uniq -c` to tally it. See
[Pipes and redirection](/concepts/pipes-and-redirection/) for why that composition works.

## A note on performance

For simple literal searches over large files, `-F` is faster than a regex search, and setting
`LC_ALL=C` before a search on ASCII text can noticeably speed up both `-F` and regex matching.
GNU grep's regex engine does extra work to handle multi-byte locales that a byte-oriented `C`
locale skips entirely.
