---
title: "ssh"
tagline: "Log into and run commands on a remote machine securely"
description: "Tested ssh examples: key-based auth, the config file, host key verification, port forwarding, multiplexing, and reading a failed connection."
category: commands
tags: [ssh, networking, security]
updated: 2026-08-12
tier: flagship
related: [copy-files-between-machines, file-permissions-explained, exit-codes-and-error-handling]
---

`ssh` opens an encrypted connection to another machine and gives you a shell on it, or runs a
single command there and streams the output back. It carries logins to servers, it is what
`scp` and `rsync` run over, it is what Git's `git@github.com:` URLs use, and every "tunnel a
port through a jump host" trick is built on it.

## An encrypted pipe with a shell on the end

`ssh user@host` does three things in order: negotiate an encrypted channel, prove your identity
to the server (and, less obviously, prove the server's identity to you), then attach that channel
to either an interactive shell or a single remote command:

```bash
ssh user@deb1.example.com            # interactive login shell
ssh user@deb1.example.com uptime     # run one command, print its output, exit
```

Everything else `ssh` does, port forwarding, agent forwarding, X11 forwarding, is that same
encrypted channel carrying something other than a shell. Once you see forwarding as "another use
of the tunnel" rather than a separate feature, the `-L`/`-R`/`-D` flags stop looking arbitrary.

## Two ways in: passwords and keys

Password authentication asks the remote machine to check a secret you type. Key-based
authentication asks it to check that you hold the *private* half of a key pair whose *public*
half is already listed in `~/.ssh/authorized_keys` on the server; nothing secret ever crosses the
wire. `ssh-keygen -t ed25519` generates a pair (Ed25519 is the current recommended type: smaller
and faster to verify than RSA, with no key-size decision to get wrong), and `ssh-copy-id` installs
the public half on a server you can still log into by password.

Keys can be encrypted at rest with a passphrase, which is what `ssh-agent` is for: unlock
a key once per session, hand it to the agent, and every subsequent `ssh` or `scp` call asks the
agent for a signature instead of prompting you again. If a private key's permissions are too
open (readable by group or other), `ssh` refuses to use it outright rather than risk a key that
anyone else on the box could read.

## The config file: stop retyping flags

`~/.ssh/config` maps a short alias to a real hostname, user, port, and key, so `ssh deb1` can mean
`ssh -p 2222 -i ~/.ssh/id_ed25519 user@deb1.example.com`. Entries are `Host` blocks read top to
bottom; the **first** matching value for a given setting wins, which is why host-specific blocks
belong above a catch-all `Host *` block, not below it. `ssh -G <host>` prints the fully resolved
configuration for a host without connecting, which is the fastest way to check *why* `ssh` is
using the port, key, or jump host it's using.

## Host keys prove the server is the one you saw last time

Password or key checks prove who *you* are; a host key check proves who the *server* is. The
first time you connect to a new host, `ssh` shows a fingerprint and asks you to confirm it, then
remembers it (hashed, by default) in `~/.ssh/known_hosts`. Every later connection compares the
server's key against that saved copy and refuses to continue if it's changed, which is exactly
what happens if someone is intercepting the connection, or, far more often in practice, if a
server was rebuilt or a hosting provider recycled an IP address. `ssh-keygen -R <host>` removes a
stale entry after you've confirmed the change is legitimate.

## Forwarding sends something other than a shell down the tunnel

`-L local:host:remote` opens a port on your machine that tunnels to a port reachable from the
*server's* side, useful for reaching a database that only listens on a remote machine's loopback
interface. `-R` runs the same idea backwards, exposing a port on your machine to the server. `-D`
turns `ssh` into a SOCKS proxy, routing arbitrary traffic through the connection without picking a
single destination port up front. All three need the connection to stay open, so they're normally
combined with `-N` (no remote command) or `-f` (background after connecting).

## Reusing one connection for everything

Every fresh `ssh` connection repeats the full handshake, which is the noticeable delay before a
prompt or `scp` transfer starts. `ControlMaster`/`ControlPath`/`ControlPersist` in the config file
let a second `ssh` (or `scp`, or `rsync -e ssh`) to the same host reuse an already-open connection
instead of negotiating a new one, cutting a login from a full round trip to almost instant.

## Reading a failure

`ssh` exits `255` for a connection-level failure (unresolvable host, refused port, rejected key,
timeout) and passes through whatever the *remote command* exited with otherwise, so a script
checking `ssh host cmd`'s exit code has to know which kind of failure it's looking at. See
[Exit codes and error handling](/concepts/exit-codes-and-error-handling/) for handling that
distinction. When the reason for a `255` isn't obvious, `-v` (repeat up to `-vvv`) prints the
handshake step by step, showing exactly where it stalled.
