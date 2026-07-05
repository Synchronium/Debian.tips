---
title: "Bulk rename a batch of files"
description: "Rename many files at once with a plain bash loop, safely handling spaces and previewing changes before committing."
category: recipes
tags: [files, scripting, one-liners]
updated: 2026-07-05
related: [find, variables-and-quoting]
---

**Problem:** A folder of files needs a consistent rename, like lowercasing extensions or adding
a shared prefix, and doing it by hand one file at a time isn't practical.

**Solution:**

```bash
for f in *.JPG; do
  mv -- "$f" "${f%.JPG}.jpg"
done
```
```
IMG_0001.jpg
IMG_0002.jpg
IMG_0003.jpg
```

**How it works:**

- `for f in *.JPG` expands to every matching filename in the current directory, one per
  iteration.
- `${f%.JPG}` strips the literal suffix `.JPG` from the end of `$f` (a bash parameter expansion,
  not a regex), leaving the base name to rebuild with a new extension.
- `mv -- "$f" "..."` renames the file. The `--` tells `mv` that no more flags follow, which
  matters if a filename happens to start with a `-`. Quoting `"$f"` is what makes this safe for
  filenames containing spaces (see
  [Variables and quoting](/scripting/variables-and-quoting/)).

**Variations:**

```bash
# Add a shared prefix to every match
for f in *.jpg; do
  mv -- "$f" "vacation-$f"
done

# Preview every rename before running it for real
for f in *report*; do
  echo mv -- "$f" "${f// /_}"
done
```

The preview variation replaces `mv` with `echo mv`, printing exactly what would run without
touching any files. Read the output, and only then remove the `echo` and re-run it. `${f// /_}`
replaces every space in `$f` with an underscore, another parameter expansion rather than a
regex substitution.

> [!TIP]
> For large or more complex renames (regex-based patterns, case-insensitive matching), the
> `rename` package (Perl-based, `apt install rename`) is worth installing; it isn't present on a
> default Debian install, so the loop above is the version that works with no setup on any
> system with bash.

If the same rename needs to apply across subdirectories too, pair the loop with
[`find`](/commands/find/) instead of relying on the shell's own glob: `find . -name "*.JPG"
-print0 | while IFS= read -r -d '' f; do mv -- "$f" "${f%.JPG}.jpg"; done` walks the whole tree
safely, including filenames with spaces or newlines.
