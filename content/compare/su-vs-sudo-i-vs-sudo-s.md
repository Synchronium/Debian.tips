---
title: "su vs sudo -i vs sudo -s"
tagline: "Four ways to become root, and what each one keeps"
description: "sudo -i, sudo -s, su and su - leave you as root with different directories and audit trails. Which to type, and why su fails on a stock Debian install."
category: compare
tags: [security, sysadmin, debian]
updated: 2026-09-05
related: [sudo, sudo-command-not-found, environment-variables-and-path]
---

Wanting a root shell is one question with four common answers, and they differ in what they carry
over from the account you started in:

```bash
cd /srv/app
printf '%-10s dir=%-9s home=%s\n' "sudo"    "$(sudo pwd)"    "$(sudo printenv HOME)"
printf '%-10s dir=%-9s home=%s\n' "sudo -s" "$(sudo -s pwd)" "$(sudo -s printenv HOME)"
printf '%-10s dir=%-9s home=%s\n' "sudo -i" "$(sudo -i pwd)" "$(sudo -i printenv HOME)"
printf '%-10s dir=%-9s home=%s\n' "su -"    "$(sudo su - -c pwd)" "$(sudo su - -c 'printenv HOME')"
printf '%-10s dir=%-9s home=%s\n' "su"      "$(sudo su -c pwd)"   "$(sudo su -c 'printenv HOME')"
```
```
sudo       dir=/srv/app  home=/root
sudo -s    dir=/srv/app  home=/root
sudo -i    dir=/root     home=/root
su -       dir=/root     home=/root
su         dir=/srv/app  home=/root
```

The `-` on `su` and the `-i` on `sudo` mean the same thing: start a login shell, which moves you to
root's home and runs root's startup files. Everything else stays where it was. `HOME` is `/root` in
all five because Debian's sudoers sets it that way; on a distribution that does not, the top three
rows would differ as well.

Those `su` rows are reached through `sudo` because `su` asks for a password and a captured page
cannot answer one. Which password each of them asks for is the first thing that separates them.

## Which password each one wants

`sudo` asks for **your** password and checks it against a policy that says what you may then do.
`su` asks for the **target account's** password, and having it makes you that account with no
policy in between.

On a stock Debian install there is no root password to give:

```bash
sudo passwd -S root | cut -d' ' -f1,2
```
```
root L
```

`L` is locked. Debian's installer offers you a root password or, if you leave it empty, puts the
first account in the `sudo` group instead, and most people take the second. A locked account
rejects every password, so `su -` on such a machine cannot succeed no matter what you type. That
accounts for a good share of "su: Authentication failure" on machines where everything else works:
there was never a password to get right.

`sudo -i` gets you the same shell and never asks for a root password, because it authenticates you
against the sudoers policy instead.

## sudo su - is sudo -i with an extra process

The combination people type when they want a root shell and know `sudo` works:

```bash
sudo su - -c 'pwd; whoami; printenv HOME'
sudo -i sh -c 'pwd; whoami; printenv HOME'
```
```
/root
root
/root
/root
root
/root
```

Identical, because `sudo` has already made you root by the time `su` runs, so `su` has nothing left
to authenticate. What you get for the extra process is a slightly worse audit record.

## What gets recorded

`sudo` logs each invocation with the command it was asked to run, so a machine's history shows
`apt update` as a line of its own. A root shell, however you reached it, logs the session and
nothing inside it: the record says you became root at half past two and says nothing about the
next forty minutes.

That granularity is why distributions moved to `sudo <command>` in the first place. It is also why
`sudo -i` for a long piece of administration beats pretending you will prefix forty commands: the
alternative is not forty logged commands, it is a root shell opened some other way and logged just
as thinly.

## Which to use

**`sudo <command>`** for anything you can express as one command. It leaves the best record and
returns you to your own account immediately.

**`sudo -i`** for a session of administration: a login shell, root's environment, and no
inherited variables from your own account to surprise a script. Reach for it when you would
otherwise type `sudo` five times in a row.

**`sudo -s`** when you want a root shell but need to stay in the directory you are standing in.
It keeps your working directory and your own shell's startup. That convenience is also how a root
command ends up running with a variable from your account that it should never have seen.

**`su -`** on a machine with no `sudo`, or when you have the root password and it is the account
you mean. It is in `util-linux`, which every Debian system has, where `sudo` is `optional` and a
minimal install may not carry it. [The `sudo` page](/commands/sudo/) has that comparison, and the
flags each one takes.

**`su` without the `-`** is the one to avoid. It gives you the target account's identity with the
calling account's environment, which is the mismatch behind a service run as the wrong user
writing to the wrong home directory.
