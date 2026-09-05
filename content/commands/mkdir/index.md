---
title: "mkdir"
tagline: "Create a directory, and the parents it needs"
description: "Tested mkdir examples: the two separate things -p does, why an existing file still fails it, and why -m never reaches the parents it invents."
category: commands
tags: [files, beginner]
updated: 2026-09-04
tier: light
related: [ls, cp, rm, chmod, file-permissions-explained]
---

`mkdir` creates a directory. Left to itself it does that and nothing more: the parent has to
exist already, and a name that is taken is an error rather than a no-op.

`-p` changes both of those at once. It builds every
missing directory in the path, and it stays quiet when the target is already there. Staying quiet
is why setup scripts use it, and the case it does not cover is a name held by a file, which
still fails.

The mode of a new directory comes from your umask, so 0022 gives 755. `-m` sets it explicitly
and the umask does not touch it, but only for the directory you named: any parents `-p` has to
invent along the way still take the default.
