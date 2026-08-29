---
title: "find"
tagline: "Locate files by name, type, size, age, and more"
description: "Tested find examples: name and type filters, size and age, permissions, -exec vs -delete, and safe scripting patterns."
category: commands
tags: [search, files]
updated: 2026-07-05
tier: flagship
related: [grep, file-permissions-explained, bulk-rename-files, sort, wc]
---

`find` walks a directory tree and prints, or acts on, every file that matches a set of tests
you give it. Where `locate` searches a pre-built index of filenames (fast, but can be stale and
only matches names), `find` inspects the filesystem live: name, type, size, age, permissions,
ownership, all of it, right now.

## Tests and actions, combined with an implicit AND

A `find` command is a directory to start from, followed by a chain of **tests** and
**actions**:

```bash
find ~/projects -name "*.log" -size +10M
```

Each test (`-name`, `-size`, `-mtime`, …) either matches a given file or it doesn't. Chain
several and `find` combines them with an implicit **AND**: a file has to pass every test to be
included. Use `-o` for **OR**, and parentheses (escaped as `\(` `\)` in most shells) to group:

```bash
find . \( -name "*.js" -o -name "*.log" \) -not -path "*/vendor/*"
```

By default the only "action" is `-print` (implied if you don't specify one), but `-exec`,
`-delete`, and `-printf` let you act on or format each match directly, without piping to another
command.

## Tests evaluate left to right

`find`'s expression is evaluated left to right with short-circuit logic, same as `&&`/`||` in
a shell. The order affects both correctness and speed: put your cheapest, most-selective test
first (usually `-name` or `-type`) so expensive tests like `-exec` only run against candidates
that already passed the cheap filters. It also decides whether `-prune` works at all. To skip a whole
directory, `-prune` has to come *before* whatever test would otherwise print or recurse into it
(see the "skip a directory" example). The same idiom with `! -readable` in front of it is how you
[search a tree without the permission denied errors](/recipes/find-permission-denied/), which is
a better answer than `2>/dev/null` for reasons of exit status as much as of noise.

## `-exec` vs `-delete` vs piping to `xargs`

Three ways to act on matches, in order of how much you should trust yourself with them:

- **`-exec cmd {} \;`** runs `cmd` once per matched file. Safe and simple, but slow on huge
  result sets since it forks once per file.
- **`-exec cmd {} +`** batches as many matches as fit on one command line into fewer
  invocations. Faster, but only works when `cmd`'s argument order doesn't matter.
- **`-delete`** removes matches directly, no subprocess at all. The fastest option and the
  most dangerous, because there's no confirmation step.
- **Piping to [`xargs`](/commands/xargs/)** (`find ... -print0 | xargs -0 cmd`) is the classic
  alternative to `-exec ... +`. Use it when you need `xargs`-specific features like
  `-P` (parallelism).

> [!WARNING]
> Before running anything with `-delete` or `-exec rm`, run the exact same `find` command with
> `-print` (or no action at all) first and read the list. `find` doesn't ask "are you sure?"
> A name test that's broader than you intended deletes broader than you intended, too.

See [`ls`](/commands/ls/) for reading the tree `find` walks, including the `-lAR` listing that
this page's own sample-file block is captured with.

## Filenames with spaces and newlines

Piping `find`'s default newline-separated output into a loop or [`xargs`](/commands/xargs/)
breaks the moment a filename contains a space or newline. `-print0` separates matches with a NUL
byte instead, which can't appear in a filename; pair it with `xargs -0` or
`while IFS= read -r -d '' f`. This isn't
a hypothetical edge case. It bites the first time your script meets a file like `Meeting Notes
(final).docx`. [Bulk rename a batch of files](/recipes/bulk-rename-files/) is that pairing
written out in full, for a job where getting it wrong renames the wrong thing.

## Permission tests are exact-match by default

`-perm 644` matches files whose mode is *exactly* `644`, not "at least these bits." To test
"this bit is set, I don't care about the rest," prefix with `-`: `-perm -u+x` matches anything
the owner can execute, regardless of group/other bits. This trips people up constantly; if your
`-perm` test is matching nothing, check whether you meant the exact form or the `-`-prefixed
"at least" form.
