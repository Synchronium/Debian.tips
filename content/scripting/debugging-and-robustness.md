---
title: "Debugging and robustness"
tagline: "bash -x, bash -n, set -u, and shellcheck"
description: "Reading what a script actually did with bash -x and PS4, checking syntax without running it, making unset variables fatal, and what shellcheck catches."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-29
order: 13
related: [exit-codes-and-error-handling, variables-and-quoting, traps-and-cleanup]
---

Most script bugs are a disagreement between what you wrote and what the shell made of it. `-x`
settles that by printing each command after expansion, just before it runs:

```bash
bash -c 'set -x; name="web server"; echo "backing up $name"'
```
```
+ name='web server'
+ echo 'backing up web server'
backing up web server
```

The trace goes to stderr, so it interleaves with output but survives being redirected away from
it. Every line is prefixed with `+`, and bash re-quotes what it prints: `name='web server'` has
quotes the original did not, because the trace shows a *value* containing a space rather than the
text you typed. That requoting is the answer to most quoting bugs, since it shows you where the
shell thinks one word ends.

## Turning it on without editing the script

```bash
bash -x script.sh
```

Same flag, applied to a whole script: nothing in the file changes, which matters when the file
belongs to a package. Inside a script `set -x` and `set +x` bracket a section, so a long
script can trace the ten lines you care about instead of all of them.

## `PS4` puts line numbers on the trace

The default prefix is `+ `, and it is worth more than that:

```bash
cat > backup.sh <<'EOF'
#!/usr/bin/env bash
PS4='+ line $LINENO: '
set -x
dest=/srv/backups
count=$(ls site | wc -l)
echo "copying $count files to $dest"
EOF

bash backup.sh
```
```
+ line 4: dest=/srv/backups
++ line 5: ls site
++ line 5: wc -l
+ line 5: count=2
+ line 6: echo 'copying 2 files to /srv/backups'
copying 2 files to /srv/backups
```

`PS4` is expanded each time it is printed, which is why `$LINENO` in single quotes is right and
double quotes would freeze it at the line the assignment is on. The extra `+` marks a subshell:
the two commands of the `$(ls site | wc -l)` pipeline are one level deeper than the assignment
they feed, and the depth of the trace is the depth of the nesting.

## `bash -n` checks syntax without running anything

Worth doing to a script that deletes things, before finding out at run time that its `for` loop
never closed:

```bash
cat > broken.sh <<'EOF'
#!/usr/bin/env bash
for f in site/*; do
  echo "found $f"
echo "done"
EOF

bash -n broken.sh
echo "status: $?"
```
```
broken.sh: line 5: syntax error: unexpected end of file
status: 2
```

The `done` is missing after line 3, and the error names line 5. That is not a bug in the message:
the shell has no way to know the loop was meant to end until it runs out of file looking for the
keyword, so a syntax error is reported where the parser gave up rather than where you went wrong.
Read upwards from the reported line to the nearest unclosed thing.

## `set -u` makes a typo fatal

An unset variable normally expands to nothing, so `rm -rf "$prefix/data"` with `prefix`
misspelled becomes `rm -rf "/data"`. `set -u` turns that into an error:

```bash
bash -c 'set -u; echo "start"; echo "value: $missing"; echo "not reached"'
echo "status: $?"
```
```
start
bash: line 1: missing: unbound variable
status: 127
```

The script stopped at the reference. A variable that is genuinely optional needs a default to
opt out, `${missing:-}` for "empty is fine" or `${missing:?message}` for "say which one is
missing", both from [Parameter expansion](/scripting/parameter-expansion/):

```bash
bash -c 'set -u; echo "value: ${missing:-none}"'
```
```
value: none
```

`set -u` is the flag with the best ratio of bugs caught to friction added, and the one to turn on
first if you are only turning on one.

## `set -euo pipefail`

The line at the top of most careful scripts, and the three flags in it are not equal.
`-u` is above. `-e` stops on the first failing command and `-o pipefail` makes a pipeline report
a failure from any stage rather than only the last; both have exceptions that a script can and
does fall through, which
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/) sets out with the cases.
Read that before relying on `-e`, because a script that fails to stop where you assumed it would
is harder to debug than one with no error handling at all.

## `shellcheck` reads the script you have not run yet

It is not installed on a base Debian system:

```bash
command -v shellcheck || echo "shellcheck: not installed"
```
```
shellcheck: not installed
```

`sudo apt install shellcheck` fixes that. It finds the class of bug this course keeps returning
to and the shell never complains about: an unquoted variable that will break on a space, a
`$var` inside single quotes that will never expand, `[ $a == $b ]` where `[[` was meant,
`cd` without checking that it worked, and a `while read` loop in a pipeline that loses its
variables. Each finding has a wiki code, and the wiki entry explains the failure rather than just
naming a rule.

## Exercises

1. A script prints `rm: cannot remove '': No such file or directory`. Which flag would have found
   this, and what does it say?

   <details><summary>Answer</summary>

   `set -u`, which would have reported `unbound variable` and named it, at the line that used it
   rather than at the command that failed. The empty string in the message is the expansion of a
   variable that was never set, usually a typo in the name.
   </details>

2. Why does `PS4="+ line $LINENO: "` behave differently from `PS4='+ line $LINENO: '`?

   <details><summary>Answer</summary>

   Double quotes expand `$LINENO` once, at the assignment, so every traced line is labelled with
   the line number of the `PS4=` line itself. Single quotes store the `$LINENO` and let the shell
   expand it each time it prints a trace line. It is the same rule as a `trap` body in
   [Traps and cleanup](/scripting/traps-and-cleanup/).
   </details>

3. `bash -n` passes and the script still fails immediately. What has it not checked?

   <details><summary>Answer</summary>

   Anything that is not grammar. `bash -n` parses; it does not run, so it cannot know whether a
   command exists, a file is readable, a variable is set or a path is right. It catches the
   unclosed `if`, the missing `fi` and the unbalanced quote, and nothing else.
   </details>

## What's next

[The capstone](/scripting/a-real-script/) puts the course together: a script with arguments, a
config file beside it, an array of work to do, a temp directory it cleans up, and the flags from
this lesson at the top.
