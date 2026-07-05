---
title: "Find and kill whatever is using a port"
description: "Identify the process bound to a TCP port that's refusing to let a service start, then stop it."
category: recipes
tags: [networking, processes, sysadmin]
updated: 2026-07-05
related: [find, exit-codes-and-error-handling]
---

**Problem:** Starting a service fails with "address already in use," and you need to find out
what's already listening on that port before you can free it up.

**Solution:**

```bash
lsof -i :8080
```
```
COMMAND   PID USER FD   TYPE  DEVICE SIZE/OFF NODE NAME
python3 24862 node 3u  IPv4 1252652      0t0  TCP *:8080 (LISTEN)
```

**How it works:**

- `-i :8080` filters `lsof`'s (list open files) output to sockets on port 8080, on any address.
- The `PID` column is what you need next: `kill 24862` stops that specific process. Try a plain
  `kill` first (sends `SIGTERM`, letting the process shut down cleanly) before reaching for
  `kill -9` (`SIGKILL`, immediate and unconditional).

**Variations:**

```bash
# ss: no separate package needed, shows the same information
ss -ltnp 'sport = :8080'

# fuser: identify and kill in one step
fuser -k 8080/tcp
```
```
8080/tcp:            24862
```

`ss` ships with the base system on Debian and doesn't require installing anything, making it the
first thing to reach for on a box you don't control. `fuser -k` skips the two-step "find the PID,
then kill it" process entirely, sending `SIGTERM` straight to whatever's using the port; useful
for a quick cleanup, but skip it when you specifically need to inspect the process (its command
line, working directory, or owner) before deciding whether killing it is actually the right call.

> [!WARNING]
> `fuser -k` kills every process using the port, not just the one you expect. On a shared or
> unfamiliar system, run `lsof -i :PORT` or `ss -ltnp` first and confirm the PID and command
> before killing anything.

All three commands default to TCP. A port bound over UDP (common for DNS resolvers or some
monitoring agents) needs `-i udp:8080` for `lsof`, `sport = :8080` with `-u` instead of `-t` for
`ss`, or `8080/udp` for `fuser`. If `kill` doesn't work and the process lingers, it's usually
stuck in an uninterruptible wait (disk I/O, most often), and `kill -9` (`SIGKILL`) is the next
step, bypassing the process's own shutdown handling entirely.
