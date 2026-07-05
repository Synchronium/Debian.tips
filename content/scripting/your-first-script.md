---
title: "Your first script"
description: "Write, mark executable, and run your first bash script, plus what the shebang line and PATH lookup actually do."
category: scripting
tags: [scripting, beginner]
updated: 2026-07-05
order: 1
related: [variables-and-quoting, file-permissions-explained, exit-codes-and-error-handling]
---

A shell script is just a text file listing commands to run in order, the same commands you'd
type interactively.

## The shebang

Every script starts with a shebang line telling the kernel which interpreter to run it with:

```bash
#!/usr/bin/env bash

echo "Hello, $(whoami)"
```

`#!/usr/bin/env bash` finds `bash` on your `PATH` rather than hardcoding `/bin/bash`, more
portable across systems where bash lives somewhere else.

## Making it executable

```bash
chmod +x hello.sh
./hello.sh
```
```
Hello, user
```

`chmod +x` sets the executable permission bit (see
[File permissions explained](/concepts/file-permissions-explained/) for the full model). Without
it, the kernel refuses to run the file directly:

```bash
./hello2.sh
```
```
bash: ./hello2.sh: Permission denied
```

That failure is exit status `126`, specifically "found the file, couldn't execute it," not to be
confused with `127` ("command not found") a moment below. You can still run an unexecutable
script by handing it to the interpreter directly: `bash hello2.sh` works with no `chmod` at all,
since you're not asking the kernel to execute the file, just asking `bash` to read and run it.

## Why the `./` is required

```bash
cd /tmp
hello.sh
```
```
bash: hello.sh: command not found
```

Without a path, bash searches only the directories listed in `$PATH`, and your current directory
usually isn't one of them, deliberately: if it were, a malicious script dropped into any
directory you `cd` into could shadow a real command by sharing its name. `./hello.sh` sidesteps
the search entirely by naming the file's exact location, so this isn't a bug to work around,
it's the safe default working as intended.

## Arguments

```bash
#!/usr/bin/env bash
echo "Script name: $0"
echo "First argument: $1"
echo "All arguments: $@"
echo "Argument count: $#"
```

```bash
./greet.sh alice bob
```
```
Script name: ./greet.sh
First argument: alice
All arguments: alice bob
Argument count: 2
```

`$0` is the script's own invocation path, `$1`, `$2`, and so on are positional arguments, `$@`
expands to all of them, and `$#` counts them. The next lesson covers why `$@` almost always
needs to be written as `"$@"` (quoted) once arguments might contain spaces.

> [!TIP]
> If `./hello.sh` fails with "command not found" rather than "permission denied," check that
> the file actually exists at that path and is spelled correctly. Both errors look similar at a
> glance but mean different things: see
> [Exit codes and error handling](/concepts/exit-codes-and-error-handling/).

## Exercises

1. Write a script that prints today's date and the current working directory, then make it
   executable and run it with `./`.

   <details><summary>Answer</summary>

   ```bash
   #!/usr/bin/env bash
   echo "Today: $(date +%F)"
   echo "Directory: $(pwd)"
   ```

   Save as `whereami.sh`, then `chmod +x whereami.sh && ./whereami.sh`.
   </details>

2. Without running `chmod +x`, find two different ways to execute a script.

   <details><summary>Answer</summary>

   Run it via the interpreter directly (`bash script.sh` or `sh script.sh`), or `chmod +x` it
   first and then invoke it with `./script.sh`. Without either the execute bit or an explicit
   interpreter, the kernel refuses to run the file and reports "Permission denied" (exit `126`).
   </details>

3. Write a script that prints an error and exits with status `1` if it's called with no
   arguments.

   <details><summary>Answer</summary>

   ```bash
   #!/usr/bin/env bash
   if [ $# -eq 0 ]; then
     echo "Usage: $0 <name>" >&2
     exit 1
   fi
   echo "Hello, $1"
   ```

   `$#` is the argument count; printing the usage message to stderr (`>&2`) rather than stdout
   is the convention for error output, covered further in
   [Exit codes and error handling](/concepts/exit-codes-and-error-handling/).
   </details>

## What's next

The next lesson covers the single biggest source of bash bugs: variables and quoting.
