---
title: "The repository is not signed"
description: "apt cannot verify a repository's signature — the NO_PUBKEY and Missing key errors. What Debian 13 changed, and why apt-key adv is no longer the fix."
category: troubleshooting
tags: [apt, debian, security, sysadmin]
updated: 2026-08-18
related: [third-party-repositories, apt, apt-essentials, release-channels]
---

You added a repository, ran an update, and apt refused it:

```
E: The repository 'http://packages.example.com stable InRelease' is not signed.
N: Updating from such a repository can't be done securely, and is therefore disabled by default.
```

Above it, depending on your Debian version, one of these:

```
W: GPG error: ... The following signatures couldn't be verified because the public key is
   not available: NO_PUBKEY 8D799EB8C4C09ACA
```
```
W: OpenPGP signature verification failed: ... Sub-process /usr/bin/sqv returned an error
   code (1), error message is: Missing key 8D799EB8..., which is needed to verify signature.
```

Both mean the same thing, and the second is what Debian 13 says — which matters, because
almost every answer you will find online was written for the first.

## What it means

apt will not install from a repository it cannot prove is genuine. Each repository signs its
index, and apt checks that signature against a key you have told it to trust. This error means
the check ran and did not pass: either you have no key for that repository, or the key you have
is not the one that made the signature.

This is not a network problem and not a broken repository. Everything else worked — apt fetched
the index perfectly well. It just will not trust it.

Reproduced here on a repository whose key is deliberately the wrong one:

<!-- verify: shape the fingerprint belongs to whichever key signed the repository -->
```bash
sudo apt-get update 2>&1 | grep -E "^E:"
```
```
E: The repository 'http://127.0.0.1:8083 stable InRelease' is not signed.
```

## Find out which key it actually wants

The error names the fingerprint of the key that made the signature. Compare it against the key
you have installed for that repository:

<!-- verify: shape the fingerprint is generated fresh on every run of the demonstration -->
```bash
gpg --show-keys --with-colons /etc/apt/keyrings/signing-demo.asc 2>/dev/null |
  awk -F: '/^fpr/ {print $10; exit}'
```
```
8EB25928373A632C89A65E5553F97D3B01FF8A7F
```

If that fingerprint is not the one in the error, you have the wrong key — which is much more
common than having no key at all, and happens whenever a vendor rotates its signing key or when
instructions were copied from an older version of a vendor's documentation.

Also check the source is pointing at the keyring you think it is:

```bash
grep -r Signed-By /etc/apt/sources.list.d/
```

A `Signed-By:` naming a file that does not exist fails exactly the same way as one naming the
wrong key.

## The fix

Fetch the repository's current key and put it where the source expects it. The vendor publishes
it; use their URL rather than a keyserver:

```bash
sudo curl -fsSL https://packages.example.com/key.asc -o /etc/apt/keyrings/example.asc
sudo chmod 644 /etc/apt/keyrings/example.asc
sudo apt-get update
```

Applied to the demonstration repository above, where the published key is served alongside it,
that is the whole fix — and the packages it offers become available:

```bash
sudo curl -fsSL http://127.0.0.1:8083/published-key.asc -o /etc/apt/keyrings/signing-demo.asc
sudo apt-get update >/dev/null 2>&1
apt-cache policy signing-demo | head -3
```
```
signing-demo:
  Installed: (none)
  Candidate: 1.0-1
```

apt reads armoured keys (`.asc`, the `-----BEGIN PGP PUBLIC KEY BLOCK-----` form) directly, so
there is no need to convert anything with `gpg --dearmor` — advice to do so is left over from
older versions.

> [!WARNING]
> Do not "fix" this by disabling verification. `[trusted=yes]` in a source, or
> `--allow-unauthenticated`, turns off the check that this error *is*. If you cannot get the
> right key, the correct conclusion is that you cannot safely use that repository yet.

## Why the old advice no longer works

Search results for this error are full of `sudo apt-key adv --keyserver ... --recv-keys ...`.
That command does not exist on Debian 13:

```bash
command -v apt-key || echo "apt-key: not installed"
```
```
apt-key: not installed
```

`apt-key` was deprecated for years and is now gone. It was removed for a good reason: every key
it added went into a system-wide trusted set, which meant any repository could be signed by any
key you had ever added for any other repository. A vendor's key added for one small tool was
trusted to authenticate replacements for anything on your system.

The replacement is `Signed-By:`, which scopes a key to the single repository it belongs to —
covered in full in
[Adding a third-party repository safely](/debian/third-party-repositories/). If you are
following instructions that use `apt-key`, they predate this change, and the rest of their
advice may be equally old.

## Avoiding it

- Prefer the vendor's own key URL over a keyserver, so you get the key they are currently
  signing with rather than one someone uploaded once.
- Always scope with `Signed-By:` — a per-repository keyring turns "my system trusts this key"
  into "this repository may use this key", which is what you meant.
- When a repository suddenly stops verifying on a machine that was working, suspect a rotated
  key before suspecting a compromise, then verify the new fingerprint against the vendor's
  published one over HTTPS. See [`apt`](/commands/apt/) for the update workflow itself.
