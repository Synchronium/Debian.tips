---
title: "tr"
tagline: "Translate, delete, or squeeze characters one at a time"
description: "36 tested tr examples: case conversion, deleting or squeezing character sets, the [^...] mistake, and real text-cleanup pipelines."
category: commands
tags: [text-processing]
updated: 2026-08-14
tier: standard
related: [sed, cut]
---

`tr` translates characters one-to-one: `tr 'a-z' 'A-Z'` maps every lowercase letter in SET1 to
the matching position in SET2. It has no concept of a "line" or a "field" — it works on the raw
character stream, which makes it fast and simple, but also the wrong tool the moment you need
context (use `sed` for that instead).

`-d` deletes every character in SET1 instead of translating it. `-s` squeezes runs of repeated
characters down to one. `-c` complements SET1 — operate on everything **not** listed, which is
how you keep only digits (`tr -cd '[:digit:]'`) rather than deleting them.

One mistake trips up almost everyone coming from `grep` or `sed`: **`tr` doesn't understand
`[^...]` as "not this."** Brackets aren't special in `tr`'s SET syntax at all — `[^0-9]` is
parsed as the literal characters `[`, `^`, `]`, plus the range `0-9`, not "anything except a
digit." Use `-c` for negation; never `[^...]`.

Character classes (`[:upper:]`, `[:lower:]`, `[:digit:]`, `[:space:]`, `[:punct:]`, `[:alnum:]`,
`[:print:]`) work inside either SET and are usually clearer than spelling out a range by hand.
