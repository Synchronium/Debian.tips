---
title: "A real script"
tagline: "Arguments, an array, a trap, and a cron line"
description: "A capstone backup script using arguments, arrays, parameter expansion, a trap and real exit codes, and how to schedule it with cron or a systemd timer."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-29
order: 14
related: [script-arguments, traps-and-cleanup, where-a-script-lives]
---

Everything in this course, in one file that does a job: archive some directories, keep the most
recent few archives, delete the rest, and report what it did.

```bash
cat backup.sh
```
```
#!/usr/bin/env bash
set -euo pipefail

here=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")

keep=5
outdir=$here/archives
label=$(date +%Y%m%d-%H%M%S)

usage() {
  echo "usage: ${0##*/} [-k keep] [-o outdir] [-l label] dir..." >&2
  exit 64
}

log() { echo "${0##*/}: $*"; }

while getopts ":k:o:l:" opt; do
  case $opt in
    k) keep=$OPTARG ;;
    o) outdir=$OPTARG ;;
    l) label=$OPTARG ;;
    *) usage ;;
  esac
done
shift $(( OPTIND - 1 ))
(( $# > 0 )) || usage

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir -p "$outdir"

for dir in "$@"; do
  if [ ! -d "$dir" ]; then
    log "no such directory: $dir"
    exit 2
  fi

  name=${dir%/}
  name=${name##*/}

  tar -czf "$work/$name-$label.tar.gz" -C "$(dirname "$dir")" "$name"
  mv "$work/$name-$label.tar.gz" "$outdir/"
  log "archived $name ($(find "$dir" -type f | wc -l) files)"

  mapfile -t old < <(ls -1 "$outdir/$name-"*.tar.gz | sort -r | tail -n +$(( keep + 1 )))
  if (( ${#old[@]} > 0 )); then
    rm -f "${old[@]}"
    log "pruned ${#old[@]} archive(s)"
  fi
done
```

Sixty lines, and no line in it is new. The table at the end says which lesson each part came
from.

## Running it

`site/` here holds three files across two directories:

```bash
./backup.sh -l 001 site
ls archives
```
```
backup.sh: archived site (3 files)
site-001.tar.gz
```

`-l` names the archive. Left off, the label is a timestamp from `date`, which is what a scheduled
run wants and what makes an example impossible to check, so every run below passes one.

The archive went to `archives/` beside the script rather than beside you, because `outdir`
defaults to `$here` and `here` was resolved from `BASH_SOURCE` rather than from `$PWD`. Run this
from anywhere, including from cron, and the archives land in the same place every time. That is
the whole payoff of [Where a script lives](/scripting/where-a-script-lives/).

## Retention

`-k` keeps that many archives per directory and deletes the rest, oldest first:

```bash
./backup.sh -k 2 -l 001 site
./backup.sh -k 2 -l 002 site
./backup.sh -k 2 -l 003 site
ls archives
```
```
backup.sh: archived site (3 files)
backup.sh: archived site (3 files)
backup.sh: archived site (3 files)
backup.sh: pruned 1 archive(s)
site-002.tar.gz
site-003.tar.gz
```

Nothing was pruned until there were more than two, and then exactly one went. The pruning is four
lines and worth reading closely:

```bash
mapfile -t old < <(ls -1 "$outdir/$name-"*.tar.gz | sort -r | tail -n +$(( keep + 1 )))
```

`mapfile` rather than `old=( $(...) )`, so a directory name containing a space cannot split one
filename into two. `sort -r` puts newest first, since the labels sort in the same order as the
dates they encode. `tail -n +$(( keep + 1 ))` takes everything from the `keep + 1`th line on,
which is the list to delete. Then `rm -f "${old[@]}"` deletes them in one call, and the `(( ))`
guard around it stops `rm` being run with no arguments at all.

## Failing usefully

A script that runs unattended is read through its exit status, so the statuses are chosen rather
than inherited:

```bash
./backup.sh; echo "no arguments:      $?"
./backup.sh -l 004 missing; echo "missing directory: $?"
./backup.sh -z; echo "unknown flag:      $?"
```
```
usage: backup.sh [-k keep] [-o outdir] [-l label] dir...
no arguments:      64
backup.sh: no such directory: missing
missing directory: 2
usage: backup.sh [-k keep] [-o outdir] [-l label] dir...
unknown flag:      64
```

`64` is `EX_USAGE` from `sysexits.h`, the closest thing to a convention for "you called this
wrong", and it is worth distinguishing from a genuine failure so a wrapper can tell a typo from a
broken disk. The usage message goes to stderr, so `backup.sh > list.txt` does not put it in the
file. Both are in [Exit codes and error handling](/concepts/exit-codes-and-error-handling/).

The temp directory is gone in every one of those cases, including the `exit 2`, because the trap
is installed before the loop rather than cleaned up at the end.

## What it is made of

| In the script | Lesson |
| --- | --- |
| `set -euo pipefail` | [Debugging and robustness](/scripting/debugging-and-robustness/) |
| `here=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")` | [Where a script lives](/scripting/where-a-script-lives/) |
| `getopts`, `shift $(( OPTIND - 1 ))`, `"$@"` | [Script arguments](/scripting/script-arguments/) |
| `usage()` and `log()`, and `usage` exiting from inside a function | [Functions](/scripting/functions/) |
| `mapfile -t old`, `"${old[@]}"`, `${#old[@]}` | [Arrays](/scripting/arrays/) |
| `${0##*/}`, `${dir%/}`, `${name##*/}` | [Parameter expansion](/scripting/parameter-expansion/) |
| `(( $# > 0 ))`, `$(( keep + 1 ))` | [Arithmetic](/scripting/arithmetic/) |
| `mktemp -d` and `trap ... EXIT` | [Traps and cleanup](/scripting/traps-and-cleanup/) |
| `for dir in "$@"`, `case` on the option | [Loops](/scripting/loops/), [Conditionals and test](/scripting/conditionals-and-test/) |

## Scheduling it

The reason the script resolves its own directory and defaults its output there is that cron runs
it from `$HOME` with almost none of your environment:

<!-- verify: skip a line for a crontab file, not output from any command -->
```
17 3 * * * /srv/deploy/backup.sh -k 7 /srv/www /var/lib/app >> /var/log/backup.log 2>&1
```

Redirect both streams, or cron mails you the output and you stop reading the mail. A systemd
timer is the other option and is better at the things cron is bad at: it can log to the journal
on its own, catch up a run the machine slept through, and be asked when it will next fire.
[cron vs systemd timers](/compare/cron-vs-systemd-timers/) is the comparison, and
[crontab](/commands/crontab/) is the command.

Whichever runs it, test the scheduled invocation rather than the interactive one. A script that
works when you run it and fails at 03:17 is nearly always failing on `PATH` or on the working
directory, both of which
[Environment variables and PATH](/concepts/environment-variables-and-path/) covers.

## Exercises

1. Add a `-n` dry-run flag that reports what would be archived and pruned without touching
   anything.

   <details><summary>Answer</summary>

   Add `n) dryrun=1 ;;` to the `case` and `n` to the `getopts` string (with no colon, since it
   takes no argument), then guard the two destructive commands:

   ```bash
   if (( dryrun )); then
     log "would archive $name"
   else
     tar -czf ...
   fi
   ```

   Default `dryrun=0` beside the other defaults, or `set -u` will stop the script the first time
   the flag is not given.
   </details>

2. The script archives each directory into a separate file. What breaks if two of the directories
   given on one command line have the same basename, and how would you fix it?

   <details><summary>Answer</summary>

   `name=${dir##*/}` reduces `/srv/www/site` and `/home/user/site` to the same `site`, so the
   second archive overwrites the first and the retention count is wrong for both. Either refuse
   duplicates, or build the name from the full path with the slashes replaced,
   `name=${dir#/}; name=${name//\//-}`.
   </details>

3. Why does `log()` write to stdout while `usage()` writes to stderr?

   <details><summary>Answer</summary>

   `log` is the script doing its job and reporting on it, which is what a caller redirecting to a
   log file wants to capture. `usage` means the script did not run at all, which belongs on stderr
   so it still reaches a person when stdout has been redirected somewhere. The exit status agrees
   with both: 0 for the first, 64 for the second.
   </details>

## Where to go next

That is the course. The pages that pick it up from here are the commands the script leans on,
[find](/commands/find/), [tar](/commands/tar/) and [xargs](/commands/xargs/), and the concepts
underneath it: [Pipes and redirection](/concepts/pipes-and-redirection/),
[Processes and signals](/concepts/processes-and-signals/) and
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/).
