---
title: "apt update failed"
tagline: "Which source failed, and why apt still exited 0"
description: "apt update reports a failure, exits 0 and carries on with an index fetched days ago. How to read the transcript and find the repository that broke."
category: troubleshooting
tags: [apt, debian, sysadmin]
updated: 2026-09-13
related: [apt, repository-is-not-signed, could-not-get-lock-dpkg-frontend, third-party-repositories]
---

`apt update` names a repository it could not fetch, then finishes:

<!-- verify: skip names an example repository that does not exist; reproduced below against a real one -->
```
W: Failed to fetch http://packages.example.com/debian/dists/stable/InRelease  Unable to connect to packages.example.com:80:
W: Some index files failed to download. They have been ignored, or old ones used instead.
```

That leaves you with two questions: which repository, and whether the failure stops anything.

The machine used below has two repositories configured. One is serving. The other answered when
its index was last fetched and has since stopped.

## The warnings go to standard error

```bash
sudo apt-get update 2>&1 >/dev/null
```
```
W: Failed to fetch http://apt.tips-legacy.example:8085/dists/stable/InRelease  Unable to connect to apt.tips-legacy.example:8085:
W: Some index files failed to download. They have been ignored, or old ones used instead.
```

`2>&1 >/dev/null` keeps standard error and throws away standard output, which on this command
splits the diagnosis from the progress report. Every `W:` and `E:` line apt prints goes to standard
error; the `Hit:`, `Get:` and `Err:` lines go to standard output.

The split has a visible consequence at the terminal: the warnings do not appear in the same place
twice. Two streams are buffered separately, so where the warnings land relative to the transcript
depends on when each buffer was flushed rather than on the order apt did anything. A cron job doing
`apt-get update > /var/log/apt-update.log` logs the transcript and throws the diagnosis away. [Pipes and redirection](/concepts/pipes-and-redirection/) covers
the two streams and how to send both to one place.

## Reading the transcript

```bash
sudo apt-get update 2>/dev/null
```
```
Ign:1 http://apt.tips-legacy.example:8085 stable InRelease
Ign:1 http://apt.tips-legacy.example:8085 stable InRelease
Ign:1 http://apt.tips-legacy.example:8085 stable InRelease
Err:1 http://apt.tips-legacy.example:8085 stable InRelease
  Could not connect to apt.tips-legacy.example:8085 (127.0.0.1). - connect (111: Connection refused)
  Unable to connect to apt.tips-legacy.example:8085:
Hit:2 http://packages.tips-vendor.example:8084 stable InRelease
Reading package lists...
```

The number after each prefix identifies the fetch, not the line, which is why `Ign:1` appears three
times: those are apt's three attempts at the same file. The `Err:1` under them is apt giving up on
it, and the indented lines beneath that are the reason, here a refused connection.

`Hit:2` is the other repository, and it means its index was already current, so nothing was
downloaded for it. `Get:` in that position means an index that had changed and was fetched.

## Which prefix means what

| Prefix | Stream | What apt is telling you |
| --- | --- | --- |
| `Hit` | stdout | The index has not changed since last time |
| `Get` | stdout | The index changed and was downloaded |
| `Ign` | stdout | One attempt did not work out; not on its own a failure |
| `Err` | stdout | apt has given up on this file |
| `W` | stderr | Something failed and apt continued anyway |
| `E` | stderr | apt stopped |

`Ign` is the one that gets misread, because it covers two situations. An attempt that will be
retried prints it, as above. So does an optional file that the repository does not publish, which
is normal and appears on healthy machines every day.

A `W` means apt could not refresh something and fell back on the copy it already had, which is why
the second warning says old ones used instead. An `E` means it has nothing it is willing to use.
Those two are what you triage on.

```bash
sudo apt-get update >/dev/null 2>&1; echo "exit: $?"
```
```
exit: 0
```

Zero, with a repository unreachable. So `apt-get update && apt-get install -y ...` proceeds to the
install, and a deployment script that treats the update as a gate has no gate.

## Finding the repository that failed

The `Err:` line gives you the URI. Turning that into the file that configures it:

```bash
grep -r --include='*.sources' -H URIs /etc/apt/sources.list.d/ | sort
```
```
/etc/apt/sources.list.d/tips-legacy.sources:URIs: http://apt.tips-legacy.example:8085
/etc/apt/sources.list.d/tips-vendor.sources:URIs: http://packages.tips-vendor.example:8084
```

Older systems keep sources in `/etc/apt/sources.list` and in `.list` files alongside the `.sources`
ones, so search both if the grep above comes back without the URI you are looking for.

Then check whether the repository is down or your machine cannot get out:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://packages.tips-vendor.example:8084/dists/stable/InRelease
curl -s -o /dev/null -w '%{http_code}\n' http://apt.tips-legacy.example:8085/dists/stable/InRelease
```
```
200
000
```

`000` is curl reporting that it never got an HTTP response at all, so the problem is below HTTP: a
refused connection, a name that does not resolve, a proxy or a firewall. A `404` from this same
request means the opposite: the repository is up, and it does not have what your source asked for.

## A suite that does not exist

Point a source at a suite the repository does not publish and the failure changes class:

```bash
sudo tee /etc/apt/sources.list.d/tips-vendor-old.sources >/dev/null <<'EOF'
Types: deb
URIs: http://packages.tips-vendor.example:8084
Suites: oldstable
Components: main
Signed-By: /etc/apt/keyrings/tips-repos.asc
EOF
sudo apt-get update 2>&1 >/dev/null; echo "exit: $?"
```
```
E: The repository 'http://packages.tips-vendor.example:8084 oldstable Release' does not have a Release file.
exit: 100
```

`E`, and exit 100. apt reached the server, asked for `dists/oldstable/`, and got a 404. The suite
in a source is a directory name on the repository, so a codename with a typo in it, a codename that
was retired, or a vendor who publishes for `stable` while your source says `bookworm` all arrive
here. Check what the repository actually publishes by fetching `dists/` in a browser or with
[`curl`](/commands/curl/) before editing the file.

Note what apt did with the rest of the machine: nothing. One source in this class takes the whole
update down, including the repositories that were fine.

## A sources file apt cannot parse

```bash
printf 'Types: deb\nURIs: http://packages.tips-vendor.example:8084\nSuites stable\nComponents: main\n' |
  sudo tee /etc/apt/sources.list.d/tips-typo.sources >/dev/null
sudo apt-get update 2>&1 >/dev/null; echo "exit: $?"
```
```
E: Malformed entry 1 in sources file /etc/apt/sources.list.d/tips-typo.sources (Suite)
E: The list of sources could not be read.
exit: 100
```

A missing colon after `Suites`. apt names the file and the field, which is as much help as it can
give, and then reads no sources at all: not the broken file, not the four good ones next to it. Any
apt command on the machine now fails the same way until the file is fixed or moved out of the
directory.

Entry 1 counts stanzas within that one file rather than lines, so on a file holding several
repositories separated by blank lines, entry 3 is the third stanza.

## What the machine believes afterwards

The unreachable repository still has an index on disk from the last time it answered, so apt goes
on offering what that index contains:

```bash
apt-cache policy tips-monitor
```
```
tips-monitor:
  Installed: (none)
  Candidate: 1.0-1
  Version table:
     1.0-1 500
        500 http://apt.tips-legacy.example:8085 stable/main all Packages
```

A candidate version, an origin, and no sign that the repository has been unreachable for a week.
The answer is as old as the last successful fetch, so on a machine whose update has been failing
quietly for a month, it is a month old.

You meet the failure when you try to install:

```bash
sudo apt-get install -y tips-monitor 2>&1 >/dev/null
```
```
E: Failed to fetch http://apt.tips-legacy.example:8085/pool/main/tips-monitor_1.0-1_all.deb  Unable to connect to apt.tips-legacy.example:8085:
E: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?
```

The suggestion at the end of that message is worth resisting. Running `apt-get update` again is
what produced the state you are in, and `--fix-missing` tells apt to skip the packages it could not
download rather than to find them.

## Making the failure stop a script

```bash
sudo apt-get update --error-on=any >/dev/null 2>&1; echo "exit: $?"
```
```
exit: 100
```

Same run, same warnings, and now a non-zero exit. `--error-on=any` promotes every one of those `W:`
lines to an `E:`, which is what you want anywhere the update is a precondition: a Docker build, a
CI job, a provisioning script. Use it in scripts and leave it off at the terminal, where you can
read the warnings yourself.

Two update failures have pages of their own, because both have more to them than a fetch that did
not work. A repository whose signature apt will not accept is
[the repository is not signed](/troubleshooting/repository-is-not-signed/), and an update that
cannot start because another process holds the package database is
[could not get lock](/troubleshooting/could-not-get-lock-dpkg-frontend/). For the sources file
itself, [adding a third-party repository safely](/debian/third-party-repositories/) has the stanza
in full.
