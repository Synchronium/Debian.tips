---
title: "sudo"
tagline: "Run a command as another user, usually root"
description: "Tested sudo and su examples: running one command as root, what the environment loses on the way, the redirect that still runs as you, and reading sudoers."
category: commands
tags: [sysadmin, security, permissions, debian]
updated: 2026-08-31
related: [chown, chmod, sudo-command-not-found, file-permissions-explained]
tier: standard
---

`sudo` runs one command as another user, root unless you say otherwise, and asks for **your**
password. `su` switches to another account for as long as you keep the shell open, and asks for
**that account's** password. That difference is why a machine with several administrators uses
the first: nobody has to know the root password, and `/var/log/auth.log` records which person ran
what. For a root shell rather than one command, the choice is between four spellings and
[su vs sudo -i vs sudo -s](/compare/su-vs-sudo-i-vs-sudo-s/) is about which to type.

## A fresh Debian install may have neither

`su` comes from `util-linux`, which Debian marks `required`, so it is always there. `sudo` is a
separate package marked `optional`. If you gave the installer a root password, it does not install
`sudo` and does not put your account in the `sudo` group; if you left the root password empty, it
does both. That single choice, made once and forgotten, is behind most of
[sudo: command not found](/troubleshooting/sudo-command-not-found/).

Debian's shipped `/etc/sudoers` grants the privilege through group membership, with one line:
`%sudo ALL=(ALL:ALL) ALL`. Adding somebody is
[`usermod -aG sudo alice`](/commands/managing-users/), run as root, and it takes
effect at their next login rather than immediately.

## The environment does not come with you

`sudo` clears the environment and rebuilds a small one. `PATH` is replaced by the `secure_path`
setting in `/etc/sudoers`, so a program you can run cannot always be run under `sudo`, and
`sudo` finds `/usr/sbin` binaries your own shell does not.

## Redirection is not part of the command

`sudo tee file` and `sudo sh -c '… > file'` exist because of one trap. In `sudo cmd > /etc/file`
the shell opens `/etc/file` before `sudo` has run, and the shell is still you, so the write is
refused and `sudo` never starts. The error comes from the shell and names the file rather than
`sudo` or the command.
