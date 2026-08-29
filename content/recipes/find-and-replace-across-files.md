---
title: "Find and replace across many files"
tagline: "Change a string everywhere, without touching the rest"
description: "Replace a string across a directory tree with grep -rl and sed -i, safely for filenames containing spaces, with a dry run and a backup first."
category: recipes
tags: [text-processing, files, search, sysadmin]
updated: 2026-08-29
related: [sed, grep, xargs]
---

**Problem:** a hostname, a path or a version string appears across a tree of config files and has
to change everywhere at once.

**Solution:** look first, then replace.

```bash
grep -rn 'old\.example\.com' config/ | sort
```
```
config/app.conf:1:upstream = old.example.com
config/app.conf:2:fallback = old.example.com
config/db.conf:1:host = old.example.com
config/legacy site.conf:1:server_name old.example.com;
```

```bash
grep -rlZ 'old\.example\.com' config/ | xargs -0 sed -i 's/old\.example\.com/new.example.com/g'
grep -rn 'example.com' config/ | sort
```
```
config/app.conf:1:upstream = new.example.com
config/app.conf:2:fallback = new.example.com
config/db.conf:1:host = new.example.com
config/legacy site.conf:1:server_name new.example.com;
```

**How it works:**

- [`grep -rn`](/commands/grep/) first, with the same pattern the replacement will use. It costs a
  second and it is the only chance to notice that the pattern matches something you did not mean.
  `| sort` because `grep -r` walks the tree in directory order, which is not alphabetical and not
  stable between machines.
- `-l` lists the files that matched instead of the matching lines, so only those files are
  rewritten. `notes.txt` above contains no match and is not opened, which keeps its modification
  time and leaves it out of any `git status` that follows.
- `-Z` ends each filename with a null byte instead of a newline, and
  [`xargs -0`](/commands/xargs/) reads them back the same way. Without the pair, a name containing
  a space arrives as two names, and the failure is loud:

```bash
grep -rl 'old\.example\.com' config/ | xargs sed -i 's/old/new/'
```
```
sed: can't read config/legacy: No such file or directory
sed: can't read site.conf: No such file or directory
```

- [`sed -i`](/commands/sed/) edits each file in place and prints nothing, so silence is success.
  `s/…/…/g` replaces every match on a line rather than the first; without the `g`, `app.conf`
  would still be right here and a file with two matches on one line would not.
- The dots are escaped in the pattern (`old\.example\.com`) because `.` matches any character in
  a regular expression, so an unescaped `old.example.com` would also match `oldXexampleYcom`.

**Variations:**

```bash
grep -rlZ 'old\.example\.com' config/ | xargs -0 sed -i.bak 's/old\.example\.com/new.example.com/g'
ls config | sort
```
```
app.conf
app.conf.bak
db.conf
db.conf.bak
legacy site.conf
legacy site.conf.bak
notes.txt
```

`sed -i.bak` keeps the original beside each file it changed, which is the version to run against
anything you cannot restore from a repository. Check the result, then `find config -name '*.bak'
-delete`, and remember that a `.bak` left behind will be picked up by the next glob that reaches
for `config/*`.

```bash
find config -name '*.conf' -print0 | xargs -0 grep -lZ 'old\.example\.com' |
  xargs -0 sed -i 's/old\.example\.com/new.example.com/g'
grep -rn 'example.com' config/ | sort
```
```
config/app.conf:1:upstream = new.example.com
config/app.conf:2:fallback = new.example.com
config/db.conf:1:host = new.example.com
config/legacy site.conf:1:server_name new.example.com;
```

Putting [`find`](/commands/find/) in front narrows the search by name, age or depth before `grep`
sees anything, which matters in a tree holding a `.git` directory or a `node_modules`. The null
separator carries through all three commands. In a tree you do not own, both `find` and `grep -r`
will also complain about directories they cannot read;
[searching without the permission denied noise](/recipes/find-permission-denied/) is the fix, and
it is not `2>/dev/null`.

For a whole word rather than a substring, `\b` anchors both ends: `sed -i 's/\bold\b/new/g'`
changes `old` and leaves `oldest` alone. In a git repository, run the replacement and read
`git diff` before committing, which is a better review than any dry run.

> [!WARNING]
> `sed -i` does not edit the file in place despite the name. It writes a new file and renames it
> over the old one, so the result has a new inode: hard links to it are broken, and a symlink is
> replaced by a regular file unless you add `--follow-symlinks`.
