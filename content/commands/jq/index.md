---
title: "jq"
tagline: "Query and reshape JSON from the command line"
description: "Tested jq examples: picking values out of nested JSON, filtering with select, reshaping objects, and getting raw strings back out into a shell script."
category: commands
tags: [text-processing, one-liners, scripting]
updated: 2026-08-19
tier: standard
related: [curl, awk, pipes-and-redirection]
---

`jq` reads JSON, applies a filter to it, and writes JSON back out. It exists because the usual
text tools cannot help you here: `grep`, `sed` and `awk` all work on lines, and JSON has no
opinion about where its lines go. The same object can arrive pretty-printed over twenty lines or
squashed onto one, and a filter written against the first shape silently returns nothing against
the second.

It is not part of a base Debian install, so start with `sudo apt install jq`.

The whole language is built out of `.`, which means "the input, unchanged". Everything else is
that with a path bolted on: `.users` reaches into a key, `.users[]` unpacks the array behind it
into one output per element, and `.users[].name` reaches into each of those in turn. Filters
chain with `|`, exactly like the shell pipe you already know, and you build a working filter by
adding one stage at a time and looking at what falls out.

Two things trip up nearly everyone. The first is that **`jq` prints JSON, including when the
result is a bare string** — you get `"Alice"`, with the quotes, because that is what the JSON
value is. `-r` (`--raw-output`) strips them, and it is what you want any time the answer is
heading into a shell variable or another command rather than into more JSON.

The second is that the shape of your input decides where your filter starts. A top-level array
starts `.[]`; an object with the array buried inside it starts `.users[]`. Run `jq . file.json`
and look before writing anything else, because guessing wrong produces `Cannot iterate over
null`, which does not say which of the two mistakes you made.

Beyond that, the useful vocabulary is small: `select` to filter, `map` to transform every element
of an array, `{}` to build a new object out of an old one, and `length`, `add`, `sort_by` and
`group_by` to answer questions about a whole collection at once.
