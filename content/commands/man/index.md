---
title: "man"
tagline: "Read the manual pages, and find the one you need"
description: "Tested man and apropos examples: what the section numbers mean, searching by description, finding which package shipped a page, and reading a synopsis."
category: commands
tags: [beginner, sysadmin, search]
updated: 2026-09-02
related: [less, apt-file, dpkg, crontab]
tier: standard
---

`man` displays the manual page for a command, a file format, a system call or a configuration
file. `apropos` searches the one-line descriptions of every page installed. People skip that
half, then spend an afternoon searching the web for something already on the machine.

Those descriptions live in an index rather than in the pages themselves. `whatis` and `man -f` are
exact-match lookups against it, `apropos` and `man -k` are substring searches, and all four answer
"nothing appropriate" when the index has not been built rather than when the page is absent.

## The number in brackets is a section

`ls(1)` and `crontab(5)` are not decoration. A name can appear in several sections, and the
number picks which one you get:

| Section | What is in it |
| --- | --- |
| 1 | Commands you run at a prompt |
| 2 | System calls, the kernel's own interface |
| 3 | Library functions, mostly the C library |
| 4 | Device files under `/dev` |
| 5 | File formats and configuration files |
| 6 | Games |
| 7 | Conventions, protocols and other overviews |
| 8 | Commands for administering the system |

`man passwd` gives you section 1, the command that changes a password. `man 5 passwd` gives you
`/etc/passwd`, the file it writes to. Without the number you get the lowest-numbered section that
has a page, so the file formats are the ones people miss.

On Debian, section 2 and section 3 are not installed with the tools. They come from
`manpages-dev`, which is why a fresh machine answers `No manual entry for printf in section 3`
while `man 1 printf` works.

## Reading a synopsis

```
ls [OPTION]... [FILE]...
```

Square brackets mean optional, `...` means the thing before it may be repeated, and a `|` between
two items means one or the other. Anything not in brackets is required. That line says `ls` takes
any number of options and any number of files, and needs neither.

## Getting around a page

`man` hands the formatted page to a pager, which on Debian is [`less`](/commands/less/) unless
`$PAGER` says otherwise. The keys are `less`'s keys: `/` to search, `n` for the next match, `q` to
quit. Piping `man` into anything else turns the pager off, so the examples below print rather than
waiting for a keypress.
