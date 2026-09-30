---
title: "free"
tagline: "How much memory is in use, and how much is really free"
description: "Tested free examples: which column to read, why free memory is small on a healthy machine, units, swap and commit, and why a container sees its host."
category: commands
tags: [monitoring, performance, sysadmin, beginner]
updated: 2026-09-30
tier: light
related: [top, ps, why-is-this-process-using-so-much-memory, processes-and-signals]
---

`free` prints one table for the whole machine: memory on the first row, swap on the second. People
usually read the `free` column first, but it is the wrong one to read. Linux keeps file contents in spare
memory as cache and hands it back the moment a program needs it, so on a machine that has been up
for a while `free` is small and should be. `available` is the figure that answers "can I start
something else", because it counts that cache as reclaimable. `used` is worked out from it, as
`total` minus `available`, so cache is never counted as used.

Every figure here describes the machine rather than a process, so no two machines print the same
table. That includes a container, which reports its host's memory rather than any limit it was given.
For which process is using the memory, see [`ps`](/commands/ps/) and [`top`](/commands/top/).
