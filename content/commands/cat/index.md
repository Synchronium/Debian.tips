---
title: "cat"
tagline: "Print files, and join them end to end"
description: "Tested cat examples: joining rotated logs, numbering lines with -n and -b, and using cat -A to find the carriage returns stopping a script from running."
category: commands
tags: [text-processing, files, beginner]
updated: 2026-08-28
tier: standard
related: [pipes-and-redirection, head, tail, tee]
---

`cat` prints a file. Given several it prints them one after another with nothing in between,
which is where the name comes from.

Most of what gets said about it is a warning. `cat access.log | grep 404` starts a process to do
what `grep 404 access.log` does alone. It is the stock example of shell written by someone who
has not noticed that filters take filenames. The complaint is aimed at the pipe. Joining two
files still needs `cat`, and so does getting a filter's output without the filename column it
prints when you hand it more than one file.

`cat -A` shows the bytes a terminal draws as nothing: tabs, trailing spaces, and the carriage
returns a file collects from an editor on Windows. A script that fails with `Illegal option -`
looks correct wherever you open it and takes one command to diagnose.
