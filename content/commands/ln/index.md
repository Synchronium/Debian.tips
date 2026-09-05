---
title: "ln"
tagline: "Two names for one file, or a pointer to a path"
description: "Tested ln examples: why a symlink's target is resolved from the link's own directory, what a hard link shares, and the -n that stops a relink landing inside."
category: commands
tags: [files, beginner]
updated: 2026-09-05
tier: light
related: [ls, cp, mv, rm, file-permissions-explained]
---

`ln -s` makes a symbolic link: a small file holding a path as text. Nothing checks that path when
the link is made or afterwards, so a symlink can point at something that does not exist, and a
relative target is read from the directory holding the link rather than from wherever you were
standing when you typed it. That single rule is behind most broken links.

`ln` without `-s` makes a hard link, which is a second name for the same data. The two names are
equal: neither is the original, and the data survives until both are gone. It cannot cross a
filesystem and cannot point at a directory.

The difference shows the moment a target is replaced. A symlink resolves the name again and finds
whatever is there now; a hard link is still attached to the data it was made from.
