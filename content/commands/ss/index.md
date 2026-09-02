---
title: "ss"
tagline: "List sockets: what is listening, and what is connected"
description: "Tested ss examples: listing listening sockets, finding the process holding a port, filtering by state and address, and reading the queue columns."
category: commands
tags: [networking, sysadmin, processes]
updated: 2026-09-02
related: [ps, kill, kill-whatever-is-using-a-port, ssh]
tier: standard
---

`ss` lists sockets: what is listening, what is connected, and which process owns each one. It
comes from `iproute2`, which Debian marks `important`, so it is present on every Debian machine
down to a minimal container. `netstat` is not. That one ships in `net-tools`, which a minimal
Debian does not install, so the command in the answer you found is often missing on the machine
you are trying to fix.

## Reading the columns

`State` is `LISTEN` for a socket waiting to be connected to and `ESTAB` for one carrying a
connection. UDP has no connection states, so a bound UDP socket reads `UNCONN`.

`Recv-Q` and `Send-Q` mean two different things depending on which of those it is. On an
established connection they are byte counts: data that has arrived and not yet been read by the
program, and data sent that the far end has not yet acknowledged. On a listening socket they are
connection counts: how many are waiting to be accepted, and the backlog the program asked for when
it called `listen()`. A listening socket whose `Recv-Q` climbs is one whose program is not
accepting fast enough.

The order of the rows means nothing. `ss` prints them in the order the kernel walked its own
tables, so two machines listening on the same ports can disagree about which comes first. No flag
sorts them, and a script comparing one listing against another needs `-H` and a `sort` of its
own.

## Who can reach a service

A service on `0.0.0.0:8080` accepts connections from anywhere that can route to the machine. The
same service on `127.0.0.1:8080` accepts them only from the machine itself. The port is the same
in both, and the address column is the whole difference between a database your application can
reach and a database everyone can.

This is why `-n` is worth typing. Without it `ss` maps port numbers to the names in
`/etc/services`, so `5432` prints as `postgresql` whether or not anything resembling PostgreSQL is
involved.

## Flags that describe one machine only

`-e`, `-i`, `-m` and `-o` add socket inodes, congestion-control state, memory accounting and
retransmit timers to each row. What they print depends on the kernel version and on what the
connection has already done, which is why the examples below leave them out: a captured copy would
show you figures your own machine will not produce. `ss -K` closes a matching socket outright, and
needs both root and a kernel built with `CONFIG_INET_DIAG_DESTROY`.
