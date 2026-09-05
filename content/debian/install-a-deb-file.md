---
title: "Installing a .deb by hand"
tagline: "Use apt for the file on disk, not dpkg -i"
description: "Install a downloaded .deb the way that resolves its dependencies, see what dpkg -i leaves behind when you don't, and read the package before you trust it."
category: debian
tags: [apt, debian, sysadmin, security]
updated: 2026-08-26
related: [apt, dpkg, third-party-repositories, remove-vs-purge-vs-autoremove]
---

Sooner or later something arrives as a `.deb` rather than as a package in the archive: a vendor's
download page, a colleague's build, a package fetched by hand from a newer Debian. Two commands
will install it. Only one of them installs what it depends on, and the other leaves a state that
is easy to mistake for a broken system.

The examples below use `hello-tips_1.0-1_all.deb`, a package built for this page. It depends on
`cowsay`, which is not installed here, and that is the only reason the two commands behave
differently at all.

## Read the package before you trust it

A `.deb` is an archive of two halves: the files to unpack, and a set of maintainer scripts dpkg
runs around the unpacking. Those scripts run as root, with no sandbox and no confirmation, so a
package from outside Debian's archive deserves a minute before it goes on.

`dpkg -I` prints the control information, and its first few lines list what is in the control
half:

<!-- verify: shape the byte counts move with the archive's own metadata -->
```bash
dpkg -I hello-tips_1.0-1_all.deb | head -6
```
```
 new Debian package, version 2.0.
 size 976 bytes: control archive=516 bytes.
     320 bytes,    10 lines      control
      66 bytes,     3 lines   *  postinst             #!/bin/sh
 Package: hello-tips
 Version: 1.0-1
```

The `*` marks a script that will be executed. This package has a `postinst`, which dpkg runs
after unpacking, and you can read it without installing anything:

```bash
dpkg-deb --info hello-tips_1.0-1_all.deb postinst
```
```
#!/bin/sh
set -e
echo "hello-tips: postinst running as $(id -un)"
```

`preinst`, `prerm` and `postrm` are the other names to look for. `dpkg -c` covers the files themselves,
listing every path the package would place and the mode it would place it with:

<!-- verify: shape the timestamps are from when the package was built -->
```bash
dpkg -c hello-tips_1.0-1_all.deb
```
```
drwxr-xr-x root/root         0 2026-08-26 15:10 ./
drwxr-xr-x root/root         0 2026-08-26 15:10 ./usr/
drwxr-xr-x root/root         0 2026-08-26 15:10 ./usr/bin/
-rwxr-xr-x root/root        53 2026-08-26 15:10 ./usr/bin/hello-tips
```

A package writing to somewhere you did not expect shows up here, before it has written anything.

## Install it with apt, and mind the `./`

```bash
apt install hello-tips_1.0-1_all.deb 2>&1 | tail -1
```
```
Error: Unable to locate package hello-tips_1.0-1_all.deb
```

That message sends a lot of people looking for a missing repository. Without a `/` in it, the
argument is a package name, and apt has correctly reported that no package is called
`hello-tips_1.0-1_all.deb`. A leading `./` makes it a path, and apt then treats the file as a
one-package source it can resolve against:

<!-- verify: shape package versions and the point release move -->
```bash
apt-get install -s ./hello-tips_1.0-1_all.deb | tail -7
```
```
The following NEW packages will be installed:
  cowsay hello-tips
0 upgraded, 2 newly installed, 0 to remove and 3 not upgraded.
Inst cowsay (3.03+dfsg2-8 Debian:13.6/stable [all])
Inst hello-tips (1.0-1 local-deb [all])
Conf cowsay (3.03+dfsg2-8 Debian:13.6/stable [all])
Conf hello-tips (1.0-1 local-deb [all])
```

`-s` simulates, which is worth doing first on anything you did not build yourself. The plan names
where each package comes from: `cowsay` from Debian, and `hello-tips` from `local-deb`, apt's
name for the file you handed it. Dropping `-s` carries the plan out:

```bash
apt-get install -y ./hello-tips_1.0-1_all.deb 2>&1 | grep -E '^(Unpacking|Setting up|hello-tips)'
```
```
Unpacking cowsay (3.03+dfsg2-8) ...
Unpacking hello-tips (1.0-1) ...
Setting up cowsay (3.03+dfsg2-8) ...
Setting up hello-tips (1.0-1) ...
hello-tips: postinst running as root
```

The last line is the `postinst` from further up, reporting who ran it.

## What `dpkg -i` does instead

dpkg is the layer beneath apt and has no idea what is in the archive, so it cannot fetch a
dependency. It unpacks the package anyway and then refuses to configure it:

<!-- verify: shape the file count is this machine's own -->
```bash
dpkg -i hello-tips_1.0-1_all.deb
```
```
Selecting previously unselected package hello-tips.
(Reading database ... 12323 files and directories currently installed.)
Preparing to unpack hello-tips_1.0-1_all.deb ...
Unpacking hello-tips (1.0-1) ...
dpkg: dependency problems prevent configuration of hello-tips:
 hello-tips depends on cowsay; however:
  Package cowsay is not installed.

dpkg: error processing package hello-tips (--install):
 dependency problems - leaving unconfigured
Errors were encountered while processing:
 hello-tips
```

The package is now in a state dpkg has a name for:

```bash
dpkg -i hello-tips_1.0-1_all.deb >/dev/null 2>&1
dpkg -l hello-tips | tail -1
hello-tips
```
```
iU  hello-tips     1.0-1        all          Demonstration package for installing a .deb by hand
/usr/bin/hello-tips: 2: exec: /usr/games/cowsay: not found
```

`iU` reads as desired-Install, status-Unpacked. The files are on the disk and on your `PATH`,
the postinst never ran, and running the command gets you an error about something else
entirely.

apt can finish the job, because it does know what is in the archive:

```bash
dpkg -i hello-tips_1.0-1_all.deb >/dev/null 2>&1
apt-get install -f -y 2>&1 | grep -E '^(Setting up|hello-tips)'
```
```
Setting up cowsay (3.03+dfsg2-8) ...
Setting up hello-tips (1.0-1) ...
hello-tips: postinst running as root
```

`-f` is `--fix-broken`. It is the standard recovery from any interrupted or half-finished
install rather than something specific to this one, which makes it the first thing to try when
apt starts refusing to do anything at all.

## Afterwards it is an ordinary package, with one gap

Once installed, the package behaves like any other. It appears in `dpkg -l`, `apt remove` and
`apt purge` work on it, and `apt autoremove` will offer to take its dependencies away with it:

```bash
apt-get install -y ./hello-tips_1.0-1_all.deb >/dev/null 2>&1
apt-get purge -y hello-tips 2>&1 | grep -E '^(Removing|Purging)'
```
```
Removing hello-tips (1.0-1) ...
```

The gap is upgrades:

```bash
apt-get install -y ./hello-tips_1.0-1_all.deb >/dev/null 2>&1
apt-cache policy hello-tips
```
```
hello-tips:
  Installed: 1.0-1
  Candidate: 1.0-1
  Version table:
 *** 1.0-1 100
        100 /var/lib/dpkg/status
```

One source, and it is dpkg's own record of what is installed. No repository offers this package,
so `apt upgrade` has nothing to compare 1.0-1 against and will never mention it again. A security
fix released by the vendor reaches you when you go and look for it.

A vendor that publishes an apt repository instead of a download link is solving exactly this,
which is why it is worth checking whether one exists before downloading the `.deb` at all. Setting one
up is covered in [third-party repositories](/debian/third-party-repositories/). Where there is no
repository, the package is yours to keep track of, so it is worth writing down somewhere what you
installed by hand and where it came from.

## When the package is not for this machine

Two mismatches account for most failures with a downloaded `.deb`, and neither is worth fighting.

If the package was built for a different processor, dpkg refuses it outright with `package
architecture (...) does not match system (...)`. Vendors usually publish one file per
architecture and the download page picks by browser, which guesses wrong often enough to be
worth checking. `dpkg --print-architecture` says what this machine wants.

A `.deb` built for a different Debian release fails later and less obviously: the architecture
matches and the dependencies do not. A package from a newer Debian asks for library versions this
release does not carry, and
apt will decline to install it rather than pull half of the next release in behind it. Forcing
past that with `dpkg -i --force-depends` produces exactly the `iU` state above, with no apt
command that can rescue it.
