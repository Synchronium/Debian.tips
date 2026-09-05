---
title: "touch"
tagline: "Create an empty file, or move a timestamp"
description: "Tested touch examples: creating a file without truncating an existing one, setting access and modification times separately, and the timestamp nothing can set."
category: commands
tags: [files, beginner]
updated: 2026-09-04
tier: light
related: [ls, find, mkdir, cp, file-permissions-explained]
---

`touch` does two jobs. Given a name that does not exist it creates an empty file; given one that
does, it leaves the contents alone and moves the timestamps to now. Neither job is what `>` does,
and the difference matters: a redirect empties whatever it lands on.

A file carries three times. `touch` sets the access time and the modification time, separately if
you ask, and `-d` or `-t` puts them wherever you want rather than at the current moment. The
third, the change time, records when the inode itself was last altered, and there is no flag for
it: setting the other two is itself a change, so it moves to now whatever you asked for.

The usual reason to set a time deliberately is to make a reference point, which [find](/commands/find/)
can then compare every other file against.
