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
cannot answer one. That is not a trick to make the example work, it is the first real difference.

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
rejects every password, so `su -` on such a machine cannot succeed no matter what you type. This
is behind a good share of "su: Authentication failure" on an otherwise working system: nothing is
broken, and there was never a password to get right.

`sudo -i` is the working equivalent, and it needs no root password because it never asks for one.

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

Identical, because `sudo` has already made you root by the time `su` runs, and `su` then has
nothing to authenticate. The difference is one extra process and a slightly worse audit record.
Nothing goes wrong if you type it, and there is no reason to.

## What gets recorded

`sudo` logs each invocation with the command it was asked to run, so a machine's history shows
`apt update` as a line of its own. A root shell, however you reached it, logs the session and
nothing inside it: the record says you became root at half past two and says nothing about the
next forty minutes.

That is the argument for `sudo <command>` over any of the shells above, and it is the reason
distributions moved to it. It is also why `sudo -i` for a long piece of work is an honest choice
rather than a lazy one: you are not going to prefix forty commands, and pretending otherwise
produces a shell opened by other means.

## Which to use

**`sudo <command>`** for anything you can express as one command. It leaves the best record and
returns you to your own account immediately.

**`sudo -i`** for a session of administration: a login shell, root's environment, and no
inherited variables from your own account to surprise a script. Reach for it when you would
otherwise type `sudo` five times in a row.

**`sudo -s`** when you want a root shell but need to stay in the directory you are standing in.
It keeps your working directory and your own shell's startup, which is convenient and is also the
form most likely to run something with a variable it should not have had.

**`su -`** on a machine with no `sudo`, or when you have the root password and it is the account
you mean. It is in `util-linux`, which every Debian system has, where `sudo` is `optional` and a
minimal install may not carry it. [The `sudo` page](/commands/sudo/) has that comparison, and the
flags each one takes.

**`su` without the `-`** is the one to avoid. It gives you the target account's identity with the
calling account's environment, which is the mismatch behind a service run as the wrong user
writing to the wrong home directory.
