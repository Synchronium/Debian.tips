---
title: "Where a script lives"
tagline: "Finding the script's own directory, and $0's limits"
description: "What $0 really contains, why a script cannot find a file next to itself with a relative path, and the BASH_SOURCE line that works through a symlink."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-29
order: 9
related: [your-first-script, script-arguments, parameter-expansion]
---

A script that ships with a config file, a template or a helper beside it has to find that file,
and the obvious way does not work. A script runs in the directory its *caller* was standing in,
which has nothing to do with where the script itself is.

## `$0` is what the caller typed

Not a path to the script. Whatever appeared on the command line:

```bash
cat > /srv/deploy/tools/whereami.sh <<'EOF'
#!/usr/bin/env bash
echo "invoked as: $0"
echo "running in: $PWD"
EOF
chmod +x /srv/deploy/tools/whereami.sh

cd /srv/deploy
./tools/whereami.sh
cd /
/srv/deploy/tools/whereami.sh
```
```
invoked as: ./tools/whereami.sh
running in: /srv/deploy
invoked as: /srv/deploy/tools/whereami.sh
running in: /
```

One script, two runs, two different values in `$0`, and `$PWD` following the caller rather than
the file. Neither run is unusual: the first is how you run a script you are sitting next to, the
second is how cron and systemd run everything.

## A relative path breaks the moment you move

`settings.conf` sits in `tools/` beside the script. Reading it by name works from one directory
and one only:

```bash
cat > /srv/deploy/tools/backup.sh <<'EOF'
#!/usr/bin/env bash
cat settings.conf
EOF
chmod +x /srv/deploy/tools/backup.sh

cd /srv/deploy/tools
./backup.sh
cd /srv/deploy
./tools/backup.sh
```
```
retain=7
cat: settings.conf: No such file or directory
```

Nothing about the script changed between those two runs except the directory it was called from.
Every relative path inside a script is resolved against `$PWD`, so one written and tested from
its own directory works there and nowhere else, which is why this tends to break first in cron
rather than in testing.

## `dirname "$0"` gets you most of the way

`$0` holds the path the caller used, so its directory part is the script's directory *as reached
from here*, which is enough to build a path to a sibling:

```bash
cat > /srv/deploy/tools/backup.sh <<'EOF'
#!/usr/bin/env bash
here=$(dirname "$0")
echo "here = $here"
cat "$here/settings.conf"
EOF
chmod +x /srv/deploy/tools/backup.sh

cd /srv/deploy
./tools/backup.sh
```
```
here = ./tools
retain=7
```

`dirname` is doing the same job as `${0%/*}` from
[Parameter expansion](/scripting/parameter-expansion/), and this is one of the cases where the
command is the better choice: `${0%/*}` returns the whole string when `$0` has no slash in it,
which is exactly what happens for a script found on `PATH`.

Now put a symlink to the script somewhere convenient, the way `/usr/local/bin` normally holds
one:

```bash
cat > /srv/deploy/tools/backup.sh <<'EOF'
#!/usr/bin/env bash
here=$(dirname "$0")
echo "here = $here"
cat "$here/settings.conf"
EOF
chmod +x /srv/deploy/tools/backup.sh
ln -s ../tools/backup.sh /srv/deploy/bin/run-backup

cd /srv/deploy
./bin/run-backup
```
```
here = ./bin
cat: ./bin/settings.conf: No such file or directory
```

`$0` is the link, so `dirname` gives the directory the link is in. Nothing has resolved anything.

## The line that works

```bash
cat > /srv/deploy/tools/backup.sh <<'EOF'
#!/usr/bin/env bash
here=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
echo "here = $here"
cat "$here/settings.conf"
EOF
chmod +x /srv/deploy/tools/backup.sh
ln -s ../tools/backup.sh /srv/deploy/bin/run-backup

cd /srv/deploy
./bin/run-backup
cd /
/srv/deploy/bin/run-backup
```
```
here = /srv/deploy/tools
retain=7
here = /srv/deploy/tools
retain=7
```

Three things are happening, and each fixes one of the failures above. `readlink -f` follows every
symlink in the path and returns an absolute one, so the `bin/` link resolves to the real file.
`dirname` then takes the directory. `BASH_SOURCE[0]` is `$0` for a script run normally, and
something better when it is not. `realpath` is interchangeable with `readlink -f` here and reads
more clearly; both are in coreutils, so both are on every Debian system.

You will also see this spelling, and it is not equivalent:

```bash
cat > /srv/deploy/tools/backup.sh <<'EOF'
#!/usr/bin/env bash
echo "cd + pwd    = $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "readlink -f = $(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
EOF
chmod +x /srv/deploy/tools/backup.sh
ln -s ../tools/backup.sh /srv/deploy/bin/run-backup

cd /srv/deploy
./bin/run-backup
```
```
cd + pwd    = /srv/deploy/bin
readlink -f = /srv/deploy/tools
```

`cd` into the directory and ask where you are: that makes the path absolute, and stops there. It
is the right answer when the script is never symlinked, and the wrong one the day somebody links
it into `/usr/local/bin`.

## `BASH_SOURCE` against `$0`

They differ when the file being run is not the file that was invoked. A sourced file has no
invocation of its own, so `$0` still belongs to the script that sourced it:

```bash
cat > /srv/deploy/tools/lib.sh <<'EOF'
echo "zero        = $0"
echo "BASH_SOURCE = ${BASH_SOURCE[0]}"
EOF
cat > /srv/deploy/tools/main.sh <<'EOF'
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
EOF
chmod +x /srv/deploy/tools/main.sh

cd /srv/deploy
./tools/main.sh
```
```
zero        = ./tools/main.sh
BASH_SOURCE = ./tools/lib.sh
```

A library that locates its own data with `$0` finds the caller's directory instead. It works for
as long as everything that sources it happens to sit in the same place. `BASH_SOURCE[0]` names
the file the line is written in, whichever script did the sourcing.

The cost is portability: `BASH_SOURCE` is a bash array and dash does not have it, so a
`#!/bin/sh` script is stuck with `$0`. See
[sh vs bash vs dash](/compare/sh-vs-bash-vs-dash/) for where that line falls on Debian.

## Exercises

1. Why does a script that works when you run it by hand fail under cron with "No such file or
   directory", even though the file it is looking for has not moved?

   <details><summary>Answer</summary>

   Because cron runs it from `$HOME` rather than from the script's directory, and every relative
   path in the script is resolved against that. The script was only ever tested from the one
   directory where its relative paths happened to be correct. Resolve paths from
   `${BASH_SOURCE[0]}` instead of trusting `$PWD`.
   </details>

2. `readlink -f "${BASH_SOURCE[0]}"` and `cd "$(dirname "${BASH_SOURCE[0]}")" && pwd` return the
   same answer most of the time. When do they differ, and which would you write?

   <details><summary>Answer</summary>

   They differ when the script was reached through a symlink: `readlink -f` resolves it to the
   real file, and the `cd` form reports the directory the link sits in. They also differ on a
   path containing a symlinked *directory*, for the same reason. Write the `readlink -f` form,
   since a script that is worth putting on someone's `PATH` is a script somebody will symlink.
   </details>

3. Make a script print its own directory in a way that survives being sourced.

   <details><summary>Answer</summary>

   ```bash
   here=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
   ```

   `$0` would name the sourcing script, which is a different file in a possibly different
   directory. `BASH_SOURCE[0]` is the file the line is written in either way.
   </details>

## What's next

The pattern in this lesson is one line at the top of a script, and every path below it is built
from `$here`. Once a script has a directory, a config file and arguments, the next thing it needs
is to clean up after itself when it stops: `trap`, `mktemp` and why `set -e` is not enough on its
own. [Exit codes and error handling](/concepts/exit-codes-and-error-handling/) is the groundwork
for that.
