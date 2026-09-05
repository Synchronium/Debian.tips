---
title: "which"
tagline: "Find a command on PATH, and nowhere else"
description: "Tested which examples: how PATH order decides the answer, the shell script Debian ships in place of the GNU program, and the deprecation that was reversed."
category: commands
tags: [environment, debian, beginner]
updated: 2026-09-05
tier: light
related: [which-vs-type-vs-command, man, cd, environment-variables-and-path, sudo-command-not-found]
---

`which` searches `PATH` for an executable file and prints the first one it finds. That is the
whole of it, and everything below follows from it: the order of the directories in `PATH` decides
the answer, and anything that is not a file on `PATH` has no answer at all. It will tell you there
is no `cd`. [which vs type vs command -v](/compare/which-vs-type-vs-command/) is that limit in
full, and what to use instead.

On Debian this is not the GNU program people expect. It is a small `/bin/sh` script from
`debianutils`, reached through the alternatives system, and it takes `-a` and `-s` and nothing
else, so a `--version` you inherited from another system is an error here. It was deprecated in
2021, and the deprecation was reversed by a Technical Committee ruling a few months later, which
is why it is still on every Debian machine.
