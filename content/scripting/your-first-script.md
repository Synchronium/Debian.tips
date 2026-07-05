---
title: "Your first script"
description: "Write, mark executable, and run your first bash script — plus what the shebang line actually does."
category: scripting
tags: [scripting, beginner]
updated: 2026-07-05
order: 1
---

A shell script is just a text file listing commands to run in order, the same commands you'd
type interactively.

## The shebang

Every script starts with a shebang line telling the kernel which interpreter to run it with:

```bash
#!/usr/bin/env bash

echo "Hello, $(whoami)"
```

`#!/usr/bin/env bash` finds `bash` on your `PATH` rather than hardcoding `/bin/bash` — more
portable across systems where bash lives somewhere else.

## Making it executable

```bash
chmod +x hello.sh
./hello.sh
```

`chmod +x` sets the executable permission bit. Without it, the kernel refuses to run the file
directly — you'd have to invoke it as `bash hello.sh` instead.

> [!TIP]
> If `./hello.sh` fails with "command not found", it's almost always because the current
> directory isn't on your `PATH` — that's normal and expected, hence the `./`.

## What's next

The next lesson covers the single biggest source of bash bugs: variables and quoting.
