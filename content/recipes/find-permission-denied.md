---
title: "Find files without the permission denied noise"
tagline: "Prune what you cannot read, rather than hiding the errors"
description: "Why 2>/dev/null is the wrong fix for find's permission denied errors, and what -readable -prune does instead, including what happens to the exit status."
category: recipes
tags: [search, files, permissions, sysadmin]
updated: 2026-08-29
related: [find, file-permissions-explained, pipes-and-redirection]
---

**Problem:** a search through a tree you do not own buries the two results you wanted under
errors about directories you were never going to be allowed to read.

```bash
find srv -name '*.conf' 2>&1 | sort
```
```
find: 'srv/cache': Permission denied
srv/logs/rotate.conf
srv/www/site.conf
```

**Solution:** tell `find` not to descend into what it cannot read, instead of hiding what it says
about it.

```bash
find srv ! -readable -prune -o -name '*.conf' -print | sort
echo "status: ${PIPESTATUS[0]}"
```
```
srv/logs/rotate.conf
srv/www/site.conf
status: 0
```

**How it works:**

- `! -readable -prune` matches anything the current user cannot read and prunes it, which stops
  [`find`](/commands/find/) descending and stops it complaining. `-o` is "or", so everything that
  was not pruned goes on to the second test.
- `-print` at the end is not optional here. Left off, `find` applies its default `-print` to the
  whole expression, including the branch that did the pruning, and `srv/cache` appears in the
  output beside the two files you asked for.
- The exit status is `0`, which is what `2>/dev/null` cannot give you: the search did what was
  asked, so a script can branch on it and a failure afterwards is a real one.
- `| sort` because `find` walks a directory in the order the filesystem hands it back, which is
  neither alphabetical nor stable between machines.

**Why not `2>/dev/null`:**

```bash
find srv typo -name '*.conf' 2>/dev/null | sort
echo "status: ${PIPESTATUS[0]}"
```
```
srv/logs/rotate.conf
srv/www/site.conf
status: 1
```

That command was given a start directory called `typo` that does not exist, and said nothing
about it. Redirecting stderr discards every error `find` produces, not the class you were tired
of reading, and the two look identical afterwards. The status is still `1`, so `find` has
reported a failure that the output gives you no way to explain.

Seeing which errors you would be throwing away costs one command, and it is the redirection worth
learning from [Pipes and redirection](/concepts/pipes-and-redirection/):

```bash
find srv typo -name '*.conf' 2>&1 >/dev/null
```
```
find: 'srv/cache': Permission denied
find: 'typo': No such file or directory
```

`2>&1 >/dev/null` points stderr at wherever stdout currently goes, and only then sends stdout to
`/dev/null`. Written the other way round it discards both, because the redirections are applied
left to right.

**Variations:**

`sudo find / -name '*.conf'` removes the errors by removing the cause, and it is the right answer
when you are searching a system you administer. It is the wrong one on a machine you share: root
reads every home directory on it.

`find / -xdev` stays on one filesystem, which cuts `/proc`, `/sys`, `/run` and any network mount
out of the walk: directories that are large, uninteresting to search, and in `/proc`'s case
changing while you read them.

Where the search is for a file you own, `find ~ -name '*.conf'` has neither problem and finishes
in a fraction of the time. [File permissions explained](/concepts/file-permissions-explained/)
covers what makes a directory unreadable in the first place, which is `r` for listing its names
and `x` for descending into it.
