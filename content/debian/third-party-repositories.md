---
title: "Adding a third-party repository safely"
description: "Why apt-key is gone, how Signed-By scopes a vendor's key to their repository alone, and how to stop that repository replacing the rest of your system."
category: debian
tags: [apt, debian, security]
updated: 2026-08-18
related: [apt-essentials, systemd-services, curl]
---

Sooner or later a vendor tells you to run four lines to install their software, and one of them
pipes a key into `apt-key add`. That instruction has been wrong for years and is now impossible:

```bash
sudo apt-key add vendor-key.asc
```
```
bash: apt-key: command not found
```

`apt-key` carried a deprecation warning for several Debian releases and was removed outright in
`apt` 3.0, which is what trixie ships. The replacement is not a new command. It is a change in
where a key lives and, more importantly, in what that key is allowed to vouch for.

> [!NOTE]
> The outputs below come from a signed repository served on `http://127.0.0.1:8080`, so every
> command on this page can be run and checked rather than taken on trust. A real vendor's
> repository differs only in the URL.

## The part worth understanding first

A repository is not a source of *its own* packages. It is a source of *packages*. Nothing stops
a repository publishing a package called `curl`, or `openssh-server`, or `sudo`, and if its
version number is higher than Debian's, `apt` will prefer it. Adding one repository with one
`apt install` line grants that vendor the ability to replace any piece of software on the
machine, at the next `apt upgrade`, without asking again.

Here is a machine before adding anything:

```bash
apt-cache policy curl
```
```
curl:
  Installed: 8.14.1-2+deb13u4
  Candidate: 8.14.1-2+deb13u4
```

And the same machine, after adding a single third-party repository that happens to publish a
package named `curl` at version `99.0-1`:

```bash
apt-cache policy curl
```
```
curl:
  Installed: 8.14.1-2+deb13u4
  Candidate: 99.0-1
  Version table:
     99.0-1 500
        500 http://127.0.0.1:8080 stable/main all Packages
```

Nothing was installed and nothing warned. The next `apt upgrade` would take it. This is not a
flaw in `apt` — it is what a repository *is* — and it is the reason the rest of this page exists.
`apt-key add` was removed because it made this worse: it added the vendor's key to a global
keyring trusted for every repository, so that key could then validly sign anything at all.

## The modern shape of a source

Debian 13 ships no `/etc/apt/sources.list` at all. Sources live in `/etc/apt/sources.list.d/` in
the **deb822** format, one stanza per repository, including Debian's own:

```bash
cat /etc/apt/sources.list.d/debian.sources
```
```
Types: deb
URIs: http://deb.debian.org/debian
Suites: trixie trixie-updates
Components: main
Signed-By: /usr/share/keyrings/debian-archive-keyring.pgp
```

`Signed-By:` is the whole point. It names the one key permitted to sign this repository, which
means a vendor's key vouches for the vendor's repository and nothing else. The old one-line
format supported the same thing with awkward bracket syntax; deb822 makes it a plain field, which
is a good enough reason to prefer it for anything you write by hand.

## Adding one

Three steps: fetch the key, save it somewhere scoped, and write a source that points at it.

```bash
sudo curl -fsSL https://packages.example.com/vendor-key.asc \
  -o /etc/apt/keyrings/example-vendor.asc
```

`/etc/apt/keyrings/` already exists on a stock trixie system and is the right home for keys you
add. It is deliberately not `/etc/apt/trusted.gpg.d/`, where anything dropped in is trusted for
every repository on the machine, which is the global-trust problem `apt-key` had.

Modern `apt` reads an ASCII-armoured key directly, so the `gpg --dearmor` step in most vendor
instructions is no longer needed and neither is having `gnupg` installed. A `.asc` file works as
it downloads:

```bash
sudo tee /etc/apt/sources.list.d/example.sources > /dev/null <<'EOF'
Types: deb
URIs: https://packages.example.com
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/example-vendor.asc
EOF
sudo apt update
```

If you would rather store the binary form, `gpg --dearmor` still works and the file conventionally
ends `.gpg`; `Signed-By:` accepts either.

## What it looks like when the key is missing or wrong

This is the error worth recognising, because the message changed in trixie. `apt` 3.0 verifies
signatures with Sequoia's `sqv` rather than `gpgv`, so the familiar `NO_PUBKEY` wording is gone:

```bash
sudo apt update
```
```
Err:1 http://127.0.0.1:8080 stable InRelease
  Sub-process /usr/bin/sqv returned an error code (1), error message is: Missing key 7AA298319813EF392C23518252AFAF4A082E547D, which is needed to verify signature.
E: The repository 'http://127.0.0.1:8080 stable InRelease' is not signed.
```

"Is not signed" overstates it. The repository is signed; you have not told `apt` which key to
accept, so it will not act on the signature. The fingerprint in the message is the key the
repository was signed with, and checking it against one the vendor publishes over a channel you
trust is the step nearly everybody skips.

The same error with a different tail (`Failed to parse keyring`) means the file at `Signed-By:` is
not a key at all. The usual cause is a download that returned an error page which got saved over
the keyring, which is exactly what `curl -f` exists to prevent. Read the file before assuming the
key is at fault.

## Restricting a repository to the packages it is for

Since a repository can offer any package, the safe configuration is to accept only the ones you
added it for. `apt` preferences do this with two stanzas: refuse everything from that origin,
then permit the package you want.

```bash
sudo tee /etc/apt/preferences.d/example-vendor > /dev/null <<'EOF'
Package: *
Pin: release o=ExampleVendor
Pin-Priority: -1

Package: hello-tips
Pin: release o=ExampleVendor
Pin-Priority: 500
EOF
sudo apt update
```

`o=` matches the `Origin:` field the repository declares, which `apt-cache policy` will show you.
A priority below zero means "never install this", so the first stanza closes the door and the
second opens it for one package. Afterwards, the `curl` from earlier is Debian's again:

```bash
apt-cache policy curl
```
```
curl:
  Installed: 8.14.1-2+deb13u4
  Candidate: 8.14.1-2+deb13u4
```

while the package you actually wanted is still available:

```bash
apt-cache policy hello-tips
```
```
hello-tips:
  Installed: (none)
  Candidate: 1.0-1
```

This costs one file per vendor and turns "this vendor can replace anything" into "this vendor can
supply the one thing I asked for".

## Common misconceptions

- **"`apt-key` is just deprecated."** It is gone. Any instruction containing it was written for
  Debian 10 or earlier, which is a reasonable prompt to check what else in those instructions has
  aged.
- **"Using HTTPS for the repository makes it trusted."** HTTPS protects the download. The
  signature is what establishes that the vendor produced the package, and `apt` checks it whether
  or not the transport was encrypted. A repository reached over HTTPS with no valid signature is
  still refused.
- **"Dropping the key in `/etc/apt/trusted.gpg.d/` is the same thing."** It works, and it grants
  that key authority over every repository configured on the machine. `Signed-By:` is the
  narrower grant, and there is no reason to prefer the wider one.
- **"I need `gpg --dearmor` first."** Not any more. Both the armoured and binary forms work in
  `Signed-By:`.
- **"A repository I added for one tool can only affect that tool."** The `curl` example above is
  what this page is for. Without pinning, it can affect anything.
- **"`apt update` succeeded, so the repository is fine."** It means the signature matched the key
  you supplied. Whether that key belongs to who you think is a question `apt` cannot answer.

## Go deeper

- [APT essentials](/debian/apt-essentials/) — the everyday commands underneath this, including
  `apt-cache policy` for asking where a package would come from
- [Managing services with systemd](/debian/systemd-services/) — what happens after you install
  something that ships a service, which on Debian is usually "it is already running"
- [`curl`](/commands/curl/) — the tested reference for the fetch, including `-f` so a 404 fails
  loudly instead of saving an error page over your keyring
