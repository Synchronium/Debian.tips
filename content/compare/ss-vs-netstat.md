---
title: "ss vs netstat"
tagline: "The one your machine has, and the one you remember"
description: "netstat is not installed on a Debian system and ss is. The flag translations, the filter syntax netstat cannot express, and when the old name is still fine."
category: compare
tags: [networking, sysadmin, debian]
updated: 2026-09-05
related: [ss, ps, kill-whatever-is-using-a-port]
---

Typing `netstat -tulpn` on a fresh Debian machine gets you `command not found`. The two commands
come from different packages, and only one of them is installed:

```bash
dpkg -S $(command -v ss) $(command -v netstat)
```
```
iproute2: /usr/bin/ss
net-tools: /usr/bin/netstat
```

`iproute2` is on every Debian system, because everything that configures an interface needs it.
`net-tools` is the older suite (`netstat`, `ifconfig`, `route`, `arp`) and has to be installed on
purpose. Debian has not dropped it and shows no sign of wanting to, so the answer to "where is
`netstat`" is `apt install net-tools`, and the better answer is that you probably do not need it.

## The same question, two layouts

Both report the socket the same way and label it differently:

```bash
ss -ltn '( sport = :8080 )'
```
```
State  Recv-Q Send-Q Local Address:Port Peer Address:Port
LISTEN 0      128          0.0.0.0:8080      0.0.0.0:*   
```

```bash
netstat -ltn | head -2; netstat -ltn | grep ':8080'
```
```
Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State      
tcp        0      0 0.0.0.0:8080            0.0.0.0:*               LISTEN     
```

`ss` puts the state first and drops the protocol, since you asked for TCP with `-t`. `netstat`
leads with the protocol and puts the state last. The `Send-Q` figures differ because they are
answering different questions: on a listening socket `ss` reports the backlog the program asked
for, and `netstat` reports zero.

The flags are otherwise the same letters, which is deliberate:

| what you want | `netstat` | `ss` |
| --- | --- | --- |
| listening sockets | `-l` | `-l` |
| TCP, UDP | `-t`, `-u` | `-t`, `-u` |
| no name resolution | `-n` | `-n` |
| the owning process | `-p` | `-p` |
| everything, not just listeners | `-a` | `-a` |

So `netstat -tulpn` becomes `ss -tulpn`, and it is the same command with a letter's worth of
difference. That much is muscle memory rather than knowledge, and it transfers unchanged.

## What ss can express and netstat cannot

`ss` takes a filter language, and the kernel does the filtering:

```bash
ss -ltnH state listening '( sport = :5432 )'
```
```
0      5      127.0.0.1:5432 0.0.0.0:*
```

`sport` and `dport` compare ports, `src` and `dst` compare addresses, and the states have names
you can ask for by name (`established`, `time-wait`, `syn-sent`). Anything equivalent with
`netstat` is a `grep`, which means matching text that happens to contain a port number rather
than asking about the port.

The difference underneath is where each one gets its data. `netstat` reads `/proc/net/tcp` and
parses it a line at a time, so a machine holding tens of thousands of connections takes a
noticeable pause. `ss` asks the kernel over a netlink socket and can push the filter down with the
question, so the kernel returns the matching sockets instead of all of them. On a laptop neither
is slow enough to care about; on a busy server it is the reason the replacement exists.

## Which to use

**`ss`**, for anything you are doing now. It is installed, it is faster, and its flags are the
ones you already know.

**`netstat`** when you are following instructions that name it and you would rather not translate
them, or when you are on a machine somebody else administers and it is already there. Install
`net-tools` and move on; nothing is deprecated to the point of breaking.

Worth knowing for the same reason: `ip addr` replaces `ifconfig` and `ip route` replaces `route`,
from the same two packages and with the same history. If `netstat` is missing on a machine, those
two are missing as well, and reaching for `apt install net-tools` to get an interface listing is
how people end up maintaining a habit rather than a system.

[The `ss` page](/commands/ss/) covers the filter syntax properly, and the recipe for
[finding what is holding a port](/recipes/kill-whatever-is-using-a-port/) is where `-p` earns its
place.
