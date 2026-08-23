---
title: "File permissions explained"
tagline: "Nine bits, and what they mean on a directory instead"
description: "The rwx/owner-group-other model, numeric vs symbolic chmod, umask, and why setuid/setgid on directories behave differently than you'd expect."
category: concepts
tags: [permissions, beginner, sysadmin]
updated: 2026-08-22
related: [chmod, find, exit-codes-and-error-handling]
---

A file's mode is nine bits: read, write and execute, for the owner, the group and everyone else.
`chmod` sets them and `umask` decides the defaults. On directories the same bits mean different
things, and `chmod` treats setuid and setgid differently again.

For the flags themselves rather than the model behind them, see [`chmod`](/commands/chmod/).

## Owner, group, and everyone else

Every file and directory has one **owner** (a user) and one **group**, plus a category for
**everyone else**. Each of those three gets its own set of three permissions: **r**ead,
**w**rite, and e**x**ecute. [`ls -l`](/commands/ls/) shows all nine bits in a row:

<!-- verify: shape the size, timestamp and link count are this file's, not a fixed value -->
```bash
ls -l script.sh
```
```
-rwxr-xr-x 1 user user 0 Jul  5 15:53 script.sh
```

Read that as three groups of three: `rwx` (owner can read, write, execute), `r-x` (group can
read and execute, not write), `r-x` (everyone else, same as group here). The leading `-` is the
file type (`-` for a regular file, `d` for a directory, `l` for a symlink).

For a **directory**, the three bits mean something slightly different: `r` lets you list its
contents, `w` lets you create or delete entries inside it, and `x` lets you `cd` into it or
access anything inside by name at all. A directory with `r--` and no `x` shows you filenames
with `ls`, but you can't open, read, or even `stat` any file inside it, because reaching a file
requires traversing the directory, and traversal needs `x`.

## Numeric mode: three digits, one per actor

`chmod` accepts a three-digit octal number: owner, group, other, in that order. Each digit sums
`r`=4, `w`=2, `x`=1:

```bash
chmod 755 script.sh   # owner: rwx (7), group: r-x (5), other: r-x (5)
chmod 644 notes.txt   # owner: rw- (6), group: r-- (4), other: r-- (4)
```

`755` is the standard mode for a script or executable; `644` is the standard mode for a plain
data file. If a permission set seems unreadable at a glance, add up which bits are on: `rwx` is
4+2+1, `r-x` is 4+1, `r--` is just 4.

## Symbolic mode: change one thing without recomputing the whole number

Numeric mode replaces all nine bits at once. Symbolic mode adjusts specific bits and leaves the
rest alone, using `u` (owner/user), `g` (group), `o` (other), or `a` (all), followed by `+`,
`-`, or `=`, followed by which permission:

```bash
chmod u+x script.sh      # add execute for the owner only
chmod go-w notes.txt     # remove write for group and other
chmod u+x,g-w file.txt   # combine multiple changes with a comma
```

Use symbolic mode when you want to flip one bit without having to work out the numeric mode for
the other eight first.

## umask: the permissions new files don't get

`umask` doesn't set permissions directly. It's a mask that's subtracted from the default mode
new files and directories would otherwise get. The Debian default is `0022`:

```bash
umask
```
```
0022
```

A new file normally starts at `666` (`rw-rw-rw-`) before the mask is applied, and a new
directory at `777`. With a umask of `022`, the `022` bits (group-write, other-write) get
cleared, leaving new files at `644` and new directories at `755`. This is why every plain file
you create lands at `644` without you ever running `chmod`: the umask is doing it for you, on
every process, for the lifetime of the shell session (or until something changes it).

## setuid, setgid, and the sticky bit

Three special bits sit above the normal nine:

- **setuid** (`chmod u+s`, numeric `4000`) on an executable makes it run with the file owner's
  privileges, not the caller's. This is how `passwd` lets an ordinary user change their own
  password despite the password database being root-owned, and how `sudo` works at all. It is
  also why [a missing sudo](/troubleshooting/sudo-command-not-found/) cannot be worked around by
  copying the binary somewhere.
- **setgid** (`chmod g+s`, numeric `2000`) on a directory makes new files created inside inherit
  the directory's group, instead of the creating user's primary group. Useful for shared team
  directories where everything should stay group-owned consistently.
- **sticky** (`chmod +t`, numeric `1000`) on a directory restricts deleting or renaming a file
  inside it to the file's owner (or root), even if others have write access to the directory.
  `/tmp` is the canonical example: everyone can create files there, but you can't delete someone
  else's.

`ls -l` shows these as a letter in the execute slot: `rwsr-xr-x` (setuid), `rwxrwsr-x` (setgid),
`rwxr-xr-t` (sticky, with the directory's own execute bit also set; a capital `T` or `S` means
the special bit is set but the underlying execute bit isn't).

## chmod on a directory preserves setuid and setgid

A three-digit `chmod` on a directory does not clear a setuid or setgid bit that is already
there:

```bash
mkdir shared
chmod 2775 shared        # set setgid: drwxrwsr-x
chmod 755 shared          # "reset" to 755... or so it seems
stat -c "%a %A" shared
```
```
2755 drwxr-sr-x
```

The setgid bit survives, even though the same three-digit `chmod` on a regular file clears those
bits without hesitation. This is documented, deliberate GNU coreutils behaviour rather than a
bug: `man chmod` says so under "SETUID AND SETGID BITS": *"For directories chmod
preserves set-user-ID and set-group-ID bits unless you explicitly specify otherwise."* To clear
them on a directory, you need an explicit fourth digit (`chmod 0755 shared`), a leading minus
(`chmod -6000 shared`), a leading equals (`chmod =755 shared`), or symbolic mode
(`chmod g-s shared`). The sticky bit doesn't get this special treatment: `chmod 1755` followed
by `chmod 755` clears it as you'd expect.

So if you're writing a script that "resets" permissions across a tree that might contain setgid
directories (a shared project folder, a mail spool), a bare `chmod -R 755` silently leaves
setgid in place. If you intend to strip it, say so explicitly.

## Common misconceptions

- **"`chmod -R` only touches files, directories are safe."** It touches everything matching,
  directories included, and removing the execute bit from a directory with `chmod -R 644` makes
  it (and everything inside) inaccessible, even to its owner. A directory reduced to
  `rw-r--r--` refuses `ls`, `cd`, or any access to its contents until the execute bit comes back.
- **"Numeric chmod always sets exactly what I typed."** True for files. Not entirely true for
  directories and the setuid/setgid bits.
- **"If I own the file, I can always read it."** Not if a directory somewhere in the path
  lacks the execute bit for you. Permission checks happen at every level of the path, not just
  on the final file.
- **"A permission-denied error and a missing-file error look the same to a script."** They
  don't have to. See
  [Exit codes and error handling](/concepts/exit-codes-and-error-handling/) for how to tell
  failure modes apart instead of treating every non-zero exit the same way.
