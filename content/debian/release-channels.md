---
title: "Debian's release channels"
tagline: "What stable, testing and unstable commit you to"
description: "What stable, testing, unstable and backports each mean, why the suite name in your sources file matters more than you think, and which to run."
category: debian
tags: [debian, apt, sysadmin]
updated: 2026-08-22
related: [apt-essentials, third-party-repositories, systemd-services]
---

Debian runs several repositories in parallel, and a package moves between them as it earns
confidence. Which one a machine is pointed at answers most questions about why a version is old,
why an upgrade appeared unasked, and whether a security fix is going to arrive.

> [!NOTE]
> The outputs below were captured on an arm64 machine. The architecture in the version-table
> lines reads `amd64` on most desktops and servers, and nothing else about them changes.

## unstable, testing, stable and experimental

**unstable**, always codenamed **sid**, is where a new version of a package lands after the
maintainer uploads it. Nothing is held back and things do break.

**testing** is fed automatically from unstable. A package migrates after a waiting period of
several days, which varies with the urgency the maintainer declared, provided it has picked up no
new release-critical bugs and its dependencies are all present. Nobody reviews a package during
that wait. The delay simply gives release-critical bugs time to be reported.

**stable** is testing at the moment it was frozen and released. After that its package versions
do not change. Fixes are backported into the existing version rather than the version being
bumped, which is why a Debian package can report an ancient version number and still carry last
week's security patch.

**experimental** is a holding area rather than a channel you track, for uploads too disruptive
even for unstable.

Only the codename is permanent. `sid` is unstable forever, but `trixie` is stable *today* and
was testing until it was released, and will be oldstable when Debian 14 arrives:

```bash
head -7 /etc/os-release
```
```
PRETTY_NAME="Debian GNU/Linux 13 (trixie)"
NAME="Debian GNU/Linux"
VERSION_ID="13"
VERSION="13 (trixie)"
VERSION_CODENAME=trixie
DEBIAN_VERSION_FULL=13.6
ID=debian
```

The `13.6` is the point release, a periodic reroll of the installation media with the accumulated
fixes folded in. It is not a different version of Debian, and a machine kept current is already
at the newest point release without doing anything.

## Codename or role in your sources file

A source can name either the codename or the role, and the two behave differently:

```
Suites: trixie      # this specific release, forever
Suites: stable      # whatever is stable at the time, changing under you
```

A machine configured with `stable` will, on the day Debian 14 is released, quietly begin
upgrading itself to it on the next `apt upgrade`. That is occasionally what you want and usually
not, particularly since a release upgrade wants to be watched rather than run by a cron job at
four in the morning. Debian's installer writes the codename for exactly this reason:

```bash
cat /etc/apt/sources.list.d/debian.sources
```
```
Types: deb
URIs: http://deb.debian.org/debian
Suites: trixie trixie-updates
Components: main
Signed-By: /usr/share/keyrings/debian-archive-keyring.pgp

Types: deb
URIs: http://deb.debian.org/debian-security
Suites: trixie-security
Components: main
Signed-By: /usr/share/keyrings/debian-archive-keyring.pgp
```

Two stanzas, because security fixes come from a different archive to everything else. If you
inherit a machine, this file is the first thing to read.

## The suites hanging off stable

Three more suites accompany a stable release, none of which are optional extras:

- **`trixie-security`** carries security fixes from the Debian Security Team. Configure it or you
  do not get security updates. It is a separate archive, `deb.debian.org/debian-security`, so it
  is a second stanza in your sources file rather than another suite on the first.
- **`trixie-updates`** carries changes that cannot wait for the next point release but are not
  security issues, such as timezone data or a virus scanner's signatures.
- **`trixie-backports`** carries newer versions of software rebuilt to run on stable. Opt-in per
  package, as below.

Security support is the reason to think twice about running testing on a server. Fixes reach
unstable first and migrate to testing on the normal schedule, so testing can sit exposed for days
after a fix exists. Stable gets it directly.

## Backports, and why nothing installs from them by accident

Adding backports does not change any version you already have. Debian assigns the suite a
priority of 100, below the default 500, so packages there are visible but never chosen:

```
Types: deb
URIs: http://deb.debian.org/debian
Suites: trixie-backports
Components: main
Signed-By: /usr/share/keyrings/debian-archive-keyring.pgp
```

With that in place, a package with a backport shows both versions and still prefers stable:

<!-- verify: shape both version numbers move as stable and backports are updated -->
```bash
apt-cache policy golang-go | grep -E "^ {5}[0-9]"
```
```
     2:1.26~1~bpo13+1 100
     2:1.24~2 500
```

The newer version is right there at priority 100, and the candidate is still stable's at 500.
Run without the `grep`, the same command names the repository each version comes from.

Asking for the backport takes `-t`:

```bash
sudo apt install -t trixie-backports golang-go
```

Simulating both makes the difference explicit, and `-s` means neither installs anything:

<!-- verify: shape the versions and the point release move whenever either suite publishes -->
```bash
apt-get install -s golang-go | grep "^Inst golang-go" | sed 's/ \[[^]]*\]//'
apt-get install -s -t trixie-backports golang-go | grep "^Inst golang-go" | sed 's/ \[[^]]*\]//'
```
```
Inst golang-go (2:1.24~2 Debian:13.6/stable)
Inst golang-go (2:1.26~1~bpo13+1 Debian Backports:stable-backports)
```

The `~bpo13+1` suffix is deliberate. A tilde sorts *before* an empty string in Debian's version
comparison, so the backport ranks below the same upstream version in the next release, and a
machine upgrading to Debian 14 moves cleanly onto the normal package rather than being stuck on a
backport that looks newer.

Backports get best-effort support from the people who maintain them, not the security team. Take
one when a specific package needs to be newer, and leave the rest of the system on stable.

## Which should you run

For anything you are responsible for, stable, with `-security` configured and backports used
sparingly for the two or three things that need to be newer. The version numbers look old and
the machine keeps working.

For a personal desktop, testing or unstable are defensible if you accept the trade: you will
occasionally get a broken morning, and you should know how to hold a package or roll one back
before you need to. Mixing channels by pinning stable and pulling a handful of packages from
unstable is the configuration that sounds clever and generates the most unanswerable dependency
problems, because a package from unstable drags in the libraries of unstable.

## Common misconceptions

- **"Debian stable is out of date and therefore insecure."** The version is frozen, the fixes
  are not. A stable package carries backported security patches under its original version
  number, which is why comparing that number against upstream's changelog tells you nothing about
  whether a vulnerability is fixed.
- **"testing is a beta of the next release, so it is safer than unstable."** For breakage, yes.
  For security, testing can be *worse*, because a fix reaches unstable first and then waits.
- **"`apt upgrade` will move me to the next release."** Only if your sources name `stable` rather
  than a codename. Read the file rather than assuming either way.
- **"Adding backports upgrades my system."** It adds nothing until you ask for a package with
  `-t`. Priority 100 prevents it.
- **"sid will become stable eventually."** sid is always unstable. It is testing that gets frozen
  and released, and the codename travels with it.

## Go deeper

- [APT essentials](/debian/apt-essentials/): the commands for inspecting all of this, including
  `apt-cache policy` and `apt-mark hold` for pinning a package you do not want moving
- [Adding a third-party repository safely](/debian/third-party-repositories/): the same
  priority machinery, applied to repositories that are not Debian's at all
- [Managing services with systemd](/debian/systemd-services/): what an upgrade does to the
  services running on the machine while it happens
