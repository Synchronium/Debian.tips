---
title: "Find and kill whatever is using a port"
tagline: "For when a service says the address is already in use"
description: "Identify the process bound to a TCP port that's refusing to let a service start, then stop it."
category: recipes
tags: [networking, processes, sysadmin]
updated: 2026-07-05
related: [find, exit-codes-and-error-handling]
---

**Problem:** Starting a service fails with "address already in use," and you need to find out
what's already listening on that port before you can free it up.

**Solution:**

<!-- verify: shape the PID, the DEVICE and NODE numbers and the column padding are specific to the process and the machine -->
```bash
lsof -i :9000
```
```
COMMAND PID USER FD   TYPE  DEVICE SIZE/OFF NODE NAME
python3  87 root 3u  IPv4 1792818      0t0  TCP *:9000 (LISTEN)
```

**How it works:**

- `-i :9000` filters `lsof`'s (list open files) output to sockets on port 9000, on any address.
- The `PID` column is what you need next: `kill 87` stops that specific process. Try a plain
  `kill` first (sends `SIGTERM`, letting the process shut down cleanly) before escalating to
  `kill -9` (`SIGKILL`, immediate and unconditional). `SIGTERM` gives the process a chance to
  release a lock or finish a write; `SIGKILL` does not, and
  [processes and signals](/concepts/processes-and-signals/) shows what that costs.
- `lsof` is not installed by default on Debian (`sudo apt install lsof`), which is the reason
  the `ss` variation below is worth knowing.

**Variations:**

<!-- verify: shape the PID and the column padding differ per process -->
```bash
# ss: no separate package needed, shows the same information
ss -ltnp 'sport = :9000'
```
```
State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess
LISTEN 0      5            0.0.0.0:9000      0.0.0.0:*    users:(("python3",pid=87,fd=3))
```

<!-- verify: skip fuser prints its "port/proto:" label on stderr and the PIDs on stdout, so a terminal shows one line while a captured pipe splits them; verified by hand with docker exec -t, which printed exactly this -->
```bash
# fuser: identify and kill in one step
fuser -k 9000/tcp
```
```
9000/tcp:               87
```

`ss` ships with the base system on Debian and doesn't require installing anything, making it the
first thing to try on a box you don't control. `fuser -k` skips the two-step "find the PID,
then kill it" process entirely, sending `SIGTERM` straight to whatever's using the port; useful
for a quick cleanup, but skip it when you specifically need to inspect the process (its command
line, working directory, or owner) before deciding whether killing it is the right call.

> [!WARNING]
> `fuser -k` kills every process using the port, not just the one you expect. On a shared or
> unfamiliar system, run `lsof -i :PORT` or `ss -ltnp` first and confirm the PID and command
> before killing anything.

All three commands default to TCP. A port bound over UDP (common for DNS resolvers or some
monitoring agents) needs `-i udp:9000` for `lsof`, `sport = :9000` with `-u` instead of `-t` for
`ss`, or `9000/udp` for `fuser`. If `kill` doesn't work and the process lingers, `kill -9`
(`SIGKILL`) is the next step, bypassing the process's own shutdown handling entirely. If `-9`
doesn't work either, the process is in an uninterruptible wait on disk or network I/O. Nothing
will move it until that wait ends.
[Processes and signals](/concepts/processes-and-signals/) covers how to tell the two cases apart.
