---
title: "Listing what is installed"
tagline: "What is on the machine, and when it arrived"
description: "List installed packages reliably with dpkg-query, tell what you asked for from what came along, and find out when a package arrived from the logs."
category: debian
tags: [apt, debian, sysadmin, files]
updated: 2026-08-26
related: [dpkg, apt, apt-cache, apt-essentials]
---

Several commands answer "what is installed", and they disagree, because they are answering
slightly different questions. One of them counts packages that were removed months ago. One of
them is a table that truncates itself to your terminal width. The command to reach for depends on
whether a person or a script is going to read the answer.

## The reliable listing

[`dpkg-query -W`](/commands/dpkg/) with an explicit format is the one to build anything on. You
name the fields, so nothing about the output depends on terminal width, locale or dpkg's mood
about columns:

```bash
dpkg-query -W -f='${Package}\n' | head -8
```
```
adduser
apt
apt-utils
base-files
base-passwd
bash
bash-completion
bsdextrautils
```

Add fields as needed. `${Version}` is the usual second one:

```bash
dpkg-query -W -f='${Package} ${Version}\n' | head -5
```
```
adduser 3.152
apt 3.0.3
apt-utils 3.0.3
base-files 13.8+deb13u6
base-passwd 3.6.7
```

**Use `${Package}` rather than `${binary:Package}`.** The second appends an architecture
qualifier to any package that could be installed for more than one architecture at a time, so
roughly half your list comes back as `libc6:amd64` while the rest stays bare. That is correct
behaviour bit it's hardly ever what you want in a script.

## dpkg-query lists more than is installed

The listing above includes `bash-completion`, which is not installed on this machine. `dpkg -W`
reports every package dpkg has a record of, and a package that was removed without being purged
keeps its record along with its configuration files. Filter on the status field to count only
what is really there:

<!-- verify: shape both counts depend on what the machine has installed -->
```bash
echo "known:     $(dpkg-query -W -f='x\n' | wc -l)"
echo "installed: $(dpkg-query -W -f='${db:Status-Abbrev}\n' | grep -c '^ii')"
```
```
known:     191
installed: 190
```

The gap is packages in the `rc` state, and on a machine a few years old it is usually larger than
one:

```bash
dpkg-query -W -f='${db:Status-Abbrev} ${Package}\n' | grep -v '^ii'
```
```
rc  bash-completion
```

[remove vs purge vs autoremove](/compare/remove-vs-purge-vs-autoremove/) covers how packages end
up there and how to finish the job.

## The two commands people reach for first

`dpkg -l` and `apt list --installed` both work and neither is meant for a pipe.

```sh
dpkg -l                 # a table, truncated to your terminal width
apt list --installed    # one line per package, plus a warning when piped
```

`dpkg -l` cuts the description column to fit the terminal, so the same command gives different
output in a narrow window, and its columns are not a stable interface between dpkg versions.
`apt list` says as much itself: if you pipe it anywhere, it will print a warning that its command-line
interface is not stable. Both are fine to read in a terminal, but shouldn't be parsed in a script.

Narrowed to a package or a pattern, `apt list` shows one thing dpkg's database does not hold at
all. The bracket at the end of each line says whether the package was asked for by name or
arrived as a dependency:

```bash
apt list --installed 'cowsay*' 'perl-modules*' 2>/dev/null | sort
```
```
Listing...
cowsay-off/stable,now 3.03+dfsg2-8 all [installed]
cowsay/stable,now 3.03+dfsg2-8 all [installed]
perl-modules-5.40/stable,now 5.40.1-6 all [installed,automatic]
```

`automatic` is apt's own bookkeeping, kept in `/var/lib/apt/extended_states` and not in dpkg's
database. `dpkg-query` has no field that will report it.

## What you asked for, and what came along

The more useful question is usually not "what is installed" but "what did I install", and apt
records the difference as one bit per package. `apt-mark showmanual` lists the packages someone
asked for by name; `showauto` lists the ones that arrived as dependencies.

<!-- verify: shape the counts depend on what the machine has installed -->
```bash
echo "manual:    $(apt-mark showmanual | wc -l)"
echo "automatic: $(apt-mark showauto | wc -l)"
```
```
manual:    34
automatic: 156
```

That first list is the interesting one. It is short enough to read, it is what actually
distinguishes this machine from a fresh install, and it is what you would want if you were
rebuilding the machine:

```bash
apt-mark showmanual | head -6
```
```
apt-utils
bzip2
ca-certificates
coreutils
cowsay
cowsay-off
```

It is also what `autoremove` consults, so a package appearing here that you never asked for is
worth investigating rather than ignoring.

## What is taking up room

`${Installed-Size}` is in kilobytes and comes from the package's own record, so this needs no
disk access at all:

<!-- verify: shape the sizes and the packages depend on what the machine has installed -->
```bash
dpkg-query -W -f='${Installed-Size}\t${Package}\n' | sort -rn | head -5
```
```
30982	libperl5.40
23769	libc6
21046	coreutils
19988	perl-modules-5.40
13327	systemd
```

This is the archive's estimate of unpacked size rather than a measurement, so it will not match
[`du`](/commands/du/) on the files. It is the right tool for "what is big", and the wrong one for
"where has my disk gone".

## When it arrived

dpkg writes a line to `/var/log/dpkg.log` for every state change it makes, timestamped:

<!-- verify: shape the timestamps are from this machine's own installs -->
```bash
grep ' cowsay-off:' /var/log/dpkg.log | head -3
```
```
2026-08-26 07:54:44 install cowsay-off:all <none> 3.03+dfsg2-8
2026-08-26 07:54:44 status half-installed cowsay-off:all 3.03+dfsg2-8
2026-08-26 07:54:44 status unpacked cowsay-off:all 3.03+dfsg2-8
```

The `install` line is the one that answers the question; the `status` lines are dpkg narrating
its own progress through unpack and configure.

There is a second answer that survives log rotation. dpkg writes a file list for every installed
package under `/var/lib/dpkg/info/`, and never touches it again, so its modification time is when
the package was configured:

<!-- verify: shape the timestamp is from this machine's own install -->
```bash
ls -l --time-style=long-iso /var/lib/dpkg/info/cowsay-off.list
```
```
-rw-r--r-- 1 root root 370 2026-08-26 07:54 /var/lib/dpkg/info/cowsay-off.list
```

Sorting that directory by time (`ls -t /var/lib/dpkg/info/*.list`) gives you the machine's
install history in order.

## Which command did it

`/var/log/apt/history.log` records apt's side: what was typed, who typed it, and when.

<!-- verify: shape the date and the command are this machine's own -->
```bash
grep -E '^(Start-Date|Commandline)' /var/log/apt/history.log | tail -2
```
```
Start-Date: 2026-08-26  07:54:48
Commandline: apt-get remove -y bash-completion
```

Each stanza in that file also carries `Install:`, `Remove:` or `Upgrade:` lines naming every
package the command touched, with its version.

Debian rotates that file, so anything older than a few weeks is in `history.log.1.gz` and its
numbered siblings. `zgrep` reads them without unpacking anything:

```bash
zgrep '^Commandline:' /var/log/apt/history.log.*.gz
```
```
/var/log/apt/history.log.1.gz:Commandline: apt install nginx
/var/log/apt/history.log.1.gz:Commandline: apt upgrade
/var/log/apt/history.log.2.gz:Commandline: apt install cowsay
/var/log/apt/history.log.2.gz:Commandline: apt purge telnet
```

That is the fastest way to answer "when did this machine get nginx, and who decided that". Note
that it only covers apt: a package installed with `dpkg -i` never touches this file, though it
still appears in `/var/log/dpkg.log`.

## Copying the list to another machine

The advice you will find most often is `dpkg --get-selections > packages.txt` on one machine and
`dpkg --set-selections < packages.txt` followed by `apt-get dselect-upgrade` on the other. It
works, and it copies all 190 packages including every dependency, which means the new machine
gets a frozen dependency set rather than one apt is free to resolve.

`apt-mark showmanual` is usually the better source:

```sh
apt-mark showmanual > wanted.txt              # on the old machine
xargs -a wanted.txt sudo apt install          # on the new one
```

Thirty-odd names instead of two hundred, and apt works out the dependencies for the release you
are installing onto rather than the one you left behind. See [`xargs`](/commands/xargs/) for what
that second line is doing.

## Go deeper

- [`dpkg`](/commands/dpkg/) for the query commands in full, including `-L` and `-S` for files.
- [`apt-cache`](/commands/apt-cache/) for the same questions asked of the archive rather than of
  the machine.
- [APT essentials](/debian/apt-essentials/) for how packages arrive in the first place.
