---
title: "cp"
tagline: "Copy a file, or a directory with -r"
description: "Tested cp examples: copying files and whole trees, why a second cp -r nests the directory inside itself, and what -a preserves that a plain copy loses."
category: commands
tags: [files, beginner]
updated: 2026-08-28
tier: light
related: [ls, mv, rm, text-file-busy, file-permissions-explained]
---

`cp` copies a file. The last argument is the destination and everything before it is a source,
so a directory at the end means "into here, keeping the name".

Two of its defaults catch people out. An existing destination is overwritten in silence, with no
prompt and no copy of what was there, which is why `-i`, `-n` and `--backup` exist. The exception
is a destination that is currently being executed, where the write is refused with
[Text file busy](/troubleshooting/text-file-busy/). And a copy is a new file,
so it takes today's timestamp and your umask decides its mode unless you ask for `-p`.

Directories need `-r`. Whether that leaves you with `published` or `published/site` depends on
whether `published` existed when you ran it, which is the one to watch in a script that might run
twice.
