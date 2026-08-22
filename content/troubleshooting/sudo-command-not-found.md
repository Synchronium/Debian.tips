---
title: "sudo: command not found"
description: "On Debian, sudo is often simply not installed, and your user is not in the sudo group. Why the installer does that, and how to fix it from a root shell."
category: troubleshooting
tags: [debian, permissions, sysadmin, beginner]
updated: 2026-08-22
related: [file-permissions-explained, apt, apt-essentials, could-not-get-lock-dpkg-frontend]
---

On a fresh Debian install, `sudo` is frequently not there at all:

```
-bash: sudo: command not found
```

Or `sudo` exists, but refuses you:

```
newbie is not in the sudoers file.
```

Both are Debian doing what it was told during installation. The fix takes about a minute, but it
needs a root shell.

## Why this happens on Debian and not on Ubuntu

Debian's installer asks you to set a root password. What you answer decides this:

- **You set a root password.** The installer concludes you will administer the machine as root,
  so it does **not** install `sudo` and does not add your user to any admin group. This is the
  path that produces `sudo: command not found`.
- **You left the root password empty.** The installer locks the root account, installs `sudo`,
  and adds your user to the `sudo` group. Ubuntu always does it this way.

Ubuntu only ever does the second, which is why every tutorial assumes `sudo` is there. On
Debian it is an ordinary optional package like any other:

```bash
apt-cache show sudo | grep -E '^(Package|Priority):'
```
```
Package: sudo
Priority: optional
```

Nothing depends on it and nothing guarantees it. A minimal install, a container image or a
cloud image built from one will often not have it.

## Which of the two problems you have

```bash
dpkg -s sudo >/dev/null 2>&1 && echo "sudo is installed" || echo "sudo is not installed"
```

If it is not installed, that is your answer. If it is, the problem is that your account is not
permitted to use it. Ask which groups you are in:

```bash
id -nG newbie
```
```
newbie
```

A user who may run `sudo` is in the `sudo` group, and this user is only in their own. You can
ask sudo directly too, which is more precise than reading groups:

```bash
su - newbie -c "echo demo | sudo -S -p '' -l" 2>&1 | tail -1
```
```
Sorry, user newbie may not run sudo on deb1.
```

And running an actual command gives the message from the top of this page:

```bash
su - newbie -c "echo demo | sudo -S -p '' true" 2>&1 | tail -1
```
```
newbie is not in the sudoers file.
```

## Fix it from a root shell

You need a root shell, and `sudo` is exactly what you do not have. Use `su`:

```bash
su -
```

It asks for the **root** password, not yours. That is the one you set during installation. Then,
depending on which problem you have:

```bash
apt update && apt install sudo          # if it was not installed
/usr/sbin/usermod -aG sudo yourusername # add yourself to the sudo group
```

Then **log out and back in.** Group membership is read when your session starts, so your current
shell will not have it. `id -nG` in the old session keeps showing the old answer, which reliably
convinces people the fix did not work.

Adding the user to the group is all it takes, because Debian's `/etc/sudoers` already grants the
group its powers. There is no need to edit that file, and editing it badly is how people lock
themselves out entirely.

```bash
usermod -aG sudo newbie && id -nG newbie
```
```
newbie sudo
```

> [!WARNING]
> Never edit `/etc/sudoers` with a normal editor. Use `visudo`, which validates the file before
> saving it. A syntax error in `/etc/sudoers` makes `sudo` refuse to run for everyone, and the
> only way back is a root shell you may not have.

## `su` and `su -` are not the same

With the dash you get root's environment, including root's `PATH`. Without it you keep your own,
and a normal user's `PATH` on Debian does not include the `sbin` directories where `usermod`
lives:

```bash
su - newbie -c 'echo $PATH'
```
```
/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games
```

So a plain `su` followed by `usermod -aG sudo you` produces `usermod: command not found`, which
looks like a second, unrelated fault and is really the same one. Either use `su -`, or give the
full path, `/usr/sbin/usermod`.

## If you have no root password either

If the root account is locked and you are not in `sudo`, nothing above will work, and you need
physical or console access to the machine: reboot, edit the GRUB entry to boot with
`init=/bin/bash`, remount the root filesystem read-write, and fix the group from there. On a
cloud instance, use the provider's console or rescue mode instead. The same rescue that makes
this possible is why an attacker with physical access is an attacker with root.

## Setting this up deliberately

- On a new Debian install where you want the Ubuntu-style arrangement, leave the root password
  blank and the installer sets all of this up for you.
- On a server you provision repeatedly, install `sudo` and set the group membership in the
  provisioning script rather than by hand. See [`apt`](/commands/apt/) for the
  non-interactive form.
- In a container image, check before assuming: many Debian base images have no `sudo` at all,
  and the answer there is usually to run as root rather than to install it.
