---
title: "remove vs purge vs autoremove"
description: "Not three strengths of one operation. Two of them differ over configuration files; the third acts only on packages you never asked for."
category: compare
tags: [apt, debian, sysadmin, beginner]
updated: 2026-08-20
related: [apt-essentials, apt-vs-apt-get, dpkg]
---

The usual explanation is that these are three settings on one dial: `remove` is gentle, `purge`
is thorough, `autoremove` tidies up afterwards. That is close enough to get you through a
tutorial and wrong enough to lose a configuration file you wanted, or to leave a disk full of
software nothing on the machine still uses.

The two distinctions are on different axes:

- **`remove` and `purge`** take the same package away. They differ over one thing: its
  configuration files.
- **`autoremove`** takes away packages *you never asked for* — the dependencies something else
  dragged in and no longer needs. It is not a stronger removal. It is a removal of different
  packages.

## remove and purge differ by one asterisk

`apt` shows you the distinction on every run, and almost nobody notices it. Both of these plan
the same removal:

```bash
apt remove --dry-run cowsay-off | grep -A1 REMOVING
apt purge --dry-run cowsay-off | grep -A1 REMOVING
```
```
REMOVING:
  cowsay-off
REMOVING:
  cowsay-off*
```

The `*` means "and its configuration". It is the entire difference, and `--dry-run` is worth
getting into your fingers precisely because that mark is easy to skim past on a confirmation
prompt you are about to answer `y` to.

What survives a `remove` is real. `nano` ships `/etc/nanorc`, and removing the editor does not
touch it:

```bash
ls /etc/nanorc
sudo apt purge -y nano > /dev/null
ls /etc/nanorc
```
```
/etc/nanorc
ls: cannot access '/etc/nanorc': No such file or directory
```

That is the whole trade. `remove` is for a package you might reinstall, where the settings you
spent an afternoon on are worth keeping. `purge` is for one you are finished with — including,
crucially, one you are about to reinstall *because its configuration is broken*, where leaving
the old file in place means reinstalling changes nothing.

## The half-removed state has a name

A removed-but-not-purged package has not left the system. It still has a row in dpkg's database,
in a state dpkg calls `config-files` and abbreviates to `rc`:

```bash
dpkg-query -W -f='${db:Status-Abbrev} ${binary:Package}\n' | grep '^rc'
```
```
rc  nano
```

Run that on a machine a few years old and it usually prints more than you expect. Each line is a
package whose binaries are gone and whose settings are not, sitting there costing nothing but
disk and a little confusion — [`dpkg -l`](/commands/dpkg/) shows the same `rc` in its first
column, which is the form you will see quoted most often.

You do not have to reinstall anything to finish the job. `purge` works directly on a package
already in that state:

```bash
apt purge --dry-run nano | grep -A1 REMOVING
```
```
REMOVING:
  nano*
```

## autoremove is answering a different question

`autoremove` does not look at how much of a package to delete. It looks at *why* each installed
package is there. apt records that as one bit per package: you asked for it, or something else
needed it.

```bash
apt-mark showmanual | grep cowsay
apt-mark showauto | grep cowsay
```
```
cowsay-off
cowsay
```

Only `cowsay-off` was ever typed at a prompt. [`cowsay`](/commands/cowsay/) came along because
`cowsay-off` depends on it, so apt marked it automatic — and that mark is what decides its fate
later.

Remove the package you asked for and apt says so, in a notice that is easy to lose in the
scroll:

```bash
sudo apt remove -y cowsay-off | grep -A2 "automatically installed"
```
```
The following package was automatically installed and is no longer required:
  cowsay
Use 'sudo apt autoremove' to remove it.
```

**Removing a package never removes its dependencies.** That surprises people, but the
alternative is worse: apt cannot know whether the library it is about to delete is holding up
something else you care about, so it leaves it and tells you. `autoremove` is the separate,
deliberate step that collects them:

```bash
sudo apt remove -y cowsay-off > /dev/null
apt autoremove --dry-run | grep -A1 REMOVING
```
```
REMOVING:
  cowsay
```

## When autoremove wants to delete something you want

This is the failure mode worth knowing about, because the fix is a single command and the
alternative is a bad afternoon. `autoremove` proposing a long list — kernels, a desktop
environment, half of X — nearly always means a metapackage that was holding those together got
removed, so everything under it is now technically unreferenced.

Read the list before agreeing to it. If something on it should stay, say so:

```bash
sudo apt remove -y cowsay-off > /dev/null
sudo apt-mark manual cowsay
apt autoremove --dry-run | grep "Removing:"
```
```
cowsay set to manually installed.
  Upgrading: 0, Installing: 0, Removing: 0, Not Upgrading: 0
```

`apt-mark manual` is not a hold and does not pin a version. It changes one fact — that you want
this package for its own sake — and `autoremove` stops proposing it, permanently.

## remove can also take more than you named

The reverse direction catches people too. Removing a package removes anything that depends on
it, because leaving those installed would break them:

```bash
apt remove --dry-run cowsay | grep -A1 REMOVING
```
```
REMOVING:
  cowsay  cowsay-off
```

One name in, two out. This is the other reason `--dry-run` earns its keep, and it is the same
reason [`apt full-upgrade`](/compare/apt-vs-apt-get/) is allowed to remove things that plain
`upgrade` is not.

## Combining them

The two axes compose, and there is a flag for each combination:

```bash
sudo apt remove pkg               # binaries gone, config kept, dependencies kept
sudo apt purge pkg                # binaries gone, config gone, dependencies kept
sudo apt autoremove               # orphaned dependencies gone, their config kept
sudo apt autoremove --purge       # orphaned dependencies gone, their config gone too
sudo apt purge --auto-remove pkg  # all four at once
```

The last one is what most people mean when they say "uninstall properly", and it is the right
default for software you installed to try out and did not keep.

`apt clean` and `apt autoclean` sound like they belong on this list and do not. They delete
downloaded `.deb` files out of `/var/cache/apt/archives`, which is a cache and not installed
software. Nothing about your package set changes.

## What none of them touch

Purge is thorough about the package's own configuration and blind to everything else:

- **Your home directory.** `~/.config`, `~/.bashrc`, a dotfile the program wrote on first run —
  none of it belongs to the package, and none of it is removed. This is deliberate: your files
  are yours.
- **Data the package created rather than shipped.** Databases under `/var/lib`, logs under
  `/var/log`, a directory a service made at runtime. Some packages offer to delete these during
  a purge and most do not.
- **Anything you edited into place by hand.** A file dpkg never registered is a file dpkg will
  never remove.

For a service, purge does clear the one piece of state people expect to survive: whether it was
enabled at boot. Debian remembers that across a `remove` and forgets it on a `purge`, which is
covered in [managing services with systemd](/debian/systemd-services/).

## The verdict

**Use `purge` by default** when you are getting rid of something. The case for `remove` is
"I want my settings back later", and if that is genuinely true you know it at the time. The case
against is silent: a stale config file that outlives your memory of writing it and then breaks a
reinstall two years later.

**Run `autoremove` when apt suggests it**, not on a schedule and never with `-y` on a machine
you care about. It is the one command here whose output is worth reading in full, because its
answer depends on marks you may have set years ago.

**Reach for `--dry-run` first** on all three. Every example above is one, and none of them cost
anything.

For the rest of the package-management vocabulary, [apt essentials](/debian/apt-essentials/) is
the tour, and [`apt`](/commands/apt/) is the reference.
