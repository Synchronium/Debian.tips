---
title: "cowsay"
tagline: "Wrap text in a speech balloon and attach a cow to it"
description: "Tested cowsay examples: piping output into it, the wrapping rules that catch people out, cowfiles and how to write one, and why -f on a download runs code."
category: commands
tags: [text-processing, one-liners, terminal]
updated: 2026-08-20
tier: standard
related: [pipes-and-redirection, apt, sudo-command-not-found]
---

`cowsay` reads text, wraps it in a speech balloon, and draws an ASCII figure underneath saying
it. That is the whole program. It is here for the same reason `wc` is: it is a filter, it reads
standard input, and it composes with everything else.

It is not part of a base Debian install, so start with `sudo apt install cowsay`.

Debian puts it in `/usr/games` rather than `/usr/bin`, and that directory is on your `PATH`
at a login shell and on almost nothing else's, not cron's, not a systemd unit's, not a
`docker exec`'s. A script that works when you run it by hand and reports `cowsay: not found`
from a cron job has hit that and nothing else, and the fix is the full path or a `PATH=` line at
the top of the crontab. The same list is visible from the other end on
[sudo: command not found](/troubleshooting/sudo-command-not-found/).

Input arrives one of two ways. Everything after the options is treated as the message, joined
with spaces, so `cowsay Hello world` and `cowsay 'Hello world'` produce the same balloon. With
no message argument it reads standard input instead, which is the form that matters: anything
that prints can be piped into it.

**`cowsay` reflows.** It does not print your text, it re-wraps it: line breaks in the input are discarded, the whole thing is treated as one
paragraph, and it is re-broken at 40 columns. Three lines in, one line out. `-W` changes the
width and `-n` turns wrapping off entirely, but `-n` works only when the text arrives on
standard input, and passing it a message argument prints the usage message instead of an error
worth reading.

The figure comes from a *cowfile*. `cowsay -l` lists the ones installed, `-f` picks one, and
`$COWPATH` is where it looks. A cowfile is not a picture: it is a small Perl program that
cowsay executes, which is why `-f` pointed at a file from the internet deserves the same
caution as any other downloaded script.
