---
title: "chown"
tagline: "Change which account and group own a file"
description: "Tested chown examples: setting owner and group, -R over a tree, why a glob misses the dotfiles, and the reason you cannot give away a file you own."
category: commands
tags: [permissions, files, sysadmin]
updated: 2026-08-28
tier: light
related: [chmod, file-permissions-explained, ls, rm]
---

`chown` sets which account owns a file and, with a colon, which group. [chmod](/commands/chmod/)
decides what the owner and the group may do; `chown` decides who they are.

It needs root, and not only for other people's files. Linux has no way to give away a file you
own outright: the rule stops a disk quota being dodged by handing a large file to a stranger, and
it means anything a script passes to another account has to be passed back by root.

The group half is looser. You may change a file's group if you own the file and belong to the
group you are naming, which is why adding an account to a group with `usermod -aG` is the usual
first step in setting up a shared directory.
