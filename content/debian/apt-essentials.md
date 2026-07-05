---
title: "APT essentials"
description: "The handful of apt commands that cover almost everything you'll do to manage Debian packages."
category: debian
tags: [apt, debian, sysadmin]
updated: 2026-07-05
---

`apt` is the command-line front end for Debian's package management system. These are the
commands you'll actually use day to day.

## Keeping the system current

```bash
sudo apt update              # refresh the local package index from your configured sources
sudo apt upgrade             # install newer versions of already-installed packages
sudo apt full-upgrade        # like upgrade, but allowed to add/remove packages to resolve dependencies
```

`apt update` doesn't install anything — it just downloads the latest list of available package
versions. Nothing on your system actually changes until you run `upgrade`.

## Installing and removing

```bash
sudo apt install ripgrep           # install a package
sudo apt remove ripgrep            # remove it, keeping configuration files
sudo apt purge ripgrep             # remove it and its configuration files
sudo apt autoremove                # clean up packages that were pulled in as dependencies
                                    # and are no longer needed by anything
```

## Searching and inspecting

```bash
apt search "text editor"     # search package names and descriptions
apt show ripgrep              # show a package's description, version, and dependencies
apt list --installed          # list every package currently installed
```

> [!TIP]
> `apt` (no suffix) is meant for interactive use — colored output, a progress bar. Scripts
> should generally prefer `apt-get`/`apt-cache`, whose output format is considered stable
> across versions.
