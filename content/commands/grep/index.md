---
title: "grep"
tagline: "Search text with patterns"
description: "Practical grep examples: recursive search, regex, context lines, and counting matches."
category: commands
tags: [search, regex, text-processing]
updated: 2026-07-05
tier: standard
---

`grep` searches its input — files, or whatever is piped to it — for lines that match a
pattern, and prints those lines. It's the tool you reach for whenever you know roughly what
you're looking for but not where it lives.

At its simplest, `grep` takes a pattern and a file:

```bash
grep "error" /var/log/syslog
```

By default the pattern is a *basic regular expression*, but you'll almost always want
`-E` (extended regex, the kind you're used to from other languages) or `-F` (fixed string,
no regex at all — faster and safer when your pattern has no special characters).

> [!TIP]
> If you find yourself escaping lots of parentheses and pipes, add `-E` and write the regex
> the way you'd expect.
