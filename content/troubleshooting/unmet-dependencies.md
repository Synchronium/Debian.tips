---
title: "Unmet dependencies"
tagline: "Three wordings, and which one says what is blocking"
description: "apt refuses to install and lists unmet dependencies. The three ways it words them, what each rules out, and finding the hold or conflict behind the refusal."
category: troubleshooting
tags: [apt, debian, sysadmin]
updated: 2026-09-15
related: [apt, apt-update-failed, packages-kept-back, apt-cache, release-channels]
---

<!-- verify: skip the reader's own package names; the same failure is reproduced below against a real repository -->
```
The following packages have unmet dependencies:
 some-package : Depends: some-library (>= 2.0) but it is not going to be installed
E: Unable to correct problems, you have held broken packages.
```

apt was asked for a set of packages, could not find an arrangement of versions that satisfies all
of their requirements at once, and stopped before touching anything. No package was installed or
removed.

Read the list underneath that message, and in particular the phrase at the end of each line. There
are three of those, they mean different things, and the fix follows from which one you have.

## The refusal, in full

```bash
sudo apt-get install -y tips-app 2>/dev/null
```
```
Reading package lists...
Building dependency tree...
Reading state information...
Solving dependencies...
Some packages could not be installed. This may mean that you have
requested an impossible situation or if you are using the unstable
distribution that some required packages have not yet been created
or been moved out of Incoming.
The following information may help to resolve the situation:

The following packages have unmet dependencies:
 tips-app : Depends: tips-lib (>= 2.0) but 1.0-1 is to be installed
```

The paragraph above the list is generic and is printed whatever the cause. `tips-app` wants
`tips-lib` at 2.0 or newer, and version 1.0-1 is what is going to be there instead.

apt splits its answer across the two streams, and everything quoted above is standard output:

```bash
sudo apt-get install -y tips-app 2>&1 >/dev/null | head -1
```
```
E: Unable to correct problems, you have held broken packages.
```

Below that line, apt 3.0 prints a second and much longer explanation from its new solver, walking
the decisions it made until two of them contradicted each other. It is worth reading on a failure
you cannot otherwise account for, and it is on standard error along with this line.

## Which of the three wordings you have

| Ends with | Means | Look at |
| --- | --- | --- |
| `but it is not installable` | No usable version exists anywhere apt can see | Your sources, or the package's name |
| `but it is not going to be installed` | A version exists and apt has decided against it | What else you asked for |
| `but N is to be installed` | Version `N` is going in and it is the wrong one | A hold, a pin, or a second repository |

The first rules out everything the other two are about, so check for it before the others.

```bash
sudo apt-get install -y tips-editor 2>/dev/null | tail -2
```
```
The following packages have unmet dependencies:
 tips-editor : Depends: tips-spell but it is not installable
```

`tips-spell` is not a package this machine has heard of. [`apt-cache policy`](/commands/apt-cache/)
answers that in one line:

```bash
apt-cache policy tips-spell
```
```
tips-spell:
  Installed: (none)
  Candidate: (none)
  Version table:
```

`Candidate: (none)` with an empty version table means no repository offers it. Either the
dependency is genuinely unavailable, which happens when a `.deb` was built for a different Debian
release, or a repository that should be supplying it is not configured or not refreshed. An update
that failed quietly leaves exactly this, which
[apt update failed](/troubleshooting/apt-update-failed/) covers.

## When the version is there and apt will not take it

The opening failure is the third wording, so a version of `tips-lib` exists. Check which:

```bash
apt-cache policy tips-lib
```
```
tips-lib:
  Installed: 1.0-1
  Candidate: 2.0-1
  Version table:
     2.0-1 500
        500 http://packages.tips-vendor.example:8089 stable/main all Packages
 *** 1.0-1 500
        500 http://packages.tips-vendor.example:8089 stable/main all Packages
        100 /var/lib/dpkg/status
```

2.0-1 is available and is the candidate, which is to say the version apt would move to. That looks
like nothing is wrong, and it is why this case takes so long to work out: whatever is stopping the
upgrade does not appear here.

A hold is the usual answer, and it has its own command:

```bash
apt-mark showhold
```
```
tips-lib
```

A held package is one somebody told dpkg to leave alone, and apt honours that in preference to
satisfying a dependency. Releasing it lets the same install proceed:

```bash
sudo apt-mark unhold tips-lib
sudo apt-get install -y tips-app 2>/dev/null | tail -4
```
```
Canceled hold on tips-lib.
Preparing to unpack .../tips-app_1.0-1_all.deb ...
Unpacking tips-app (1.0-1) ...
Setting up tips-lib (2.0-1) ...
Setting up tips-app (1.0-1) ...
```

Find out why the hold was there before removing it. A hold placed to keep a working kernel, a
database server at the version its data files expect, or a package a vendor's installer manages
itself was put there deliberately, and the dependency that now wants it upgraded is the thing to
reconsider.

A pin does the same job invisibly from `/etc/apt/preferences.d/`, and shows up in the `Version
table` above as a priority that is not 500. [Debian's release channels](/debian/release-channels/)
covers what those numbers mean and why mixing suites produces this failure more than anything else
does.

## A requirement that cannot be satisfied by anything

```bash
sudo apt-get install -y tips-suite 2>/dev/null | tail -2
```
```
The following packages have unmet dependencies:
 tips-suite : Depends: tips-beta but it is not installable
```

`tips-beta` is in the repository, and apt still calls it not installable, because `tips-suite`
depends on `tips-alpha` as well and those two declare a conflict. No arrangement satisfies both, so
the dependency that loses is reported as though it were missing. When a package named as not
installable is one you can see in the archive, a conflict elsewhere in the same request is the
thing to look for, and the solver explanation on standard error names the other side of it.

## Before you let apt fix it

`apt --fix-broken install`, and the older `apt-get -f install`, are for a different state: a
package already unpacked whose dependencies were never satisfied, usually after a `dpkg -i` of a
downloaded `.deb`. They do not help here, because nothing has been installed yet.

Where they do apply, read the plan before agreeing to it. The way apt fixes a broken dependency is
often to remove the package that has it, which resolves the complaint and loses the software you
were installing. `-s` prints that plan and changes nothing:

```bash
sudo apt-get install -s tips-app 2>/dev/null | tail -2
```
```
The following packages have unmet dependencies:
 tips-app : Depends: tips-lib (>= 2.0) but 1.0-1 is to be installed
```

See [`apt`](/commands/apt/) for the rest of what `-s` is good for, and
[packages kept back](/troubleshooting/packages-kept-back/) for the neighbouring case, where apt has
an arrangement it is willing to make and declines to make it.
