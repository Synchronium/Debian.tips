---
title: "How this site is tested"
description: "Every command example on debian.tips is run for real in a disposable Debian container, and the output you see is what it printed."
---

Most command references are written from memory. Someone remembers roughly what `tar -tvf`
prints, types something plausible, and it sits there for years. The command changes, the
distribution changes, the output drifts, and nobody notices because nothing ever checks.

This site does it the other way round. Every example is run inside a throwaway Debian
container, and the output on the page is pasted from that run. Then it is run again, on
every push, and the page fails the build if what it prints has changed.

Right now that is **{{replayed}} outputs re-run on every push**, across {{commandPages}}
command pages and {{prosePages}} of the written articles, alongside {{fixtures}} blocks of
sample data. A further {{exemptions}} are documented but cannot be automated, and are listed as
such below. Nothing re-runs a page until a setup script exists for it, and that is still true
of {{unreplayedCommandPages}} of the command pages and {{unreplayedProsePages}} of the written
articles. The numbers on this page are counted from the content when the site is built, so they
cannot drift either.

## What the replay does

For each command page there is a setup script that creates the sample files, and a replay
that runs every example against them:

```sh
npm run replay              # every page, in one disposable container
npm run replay -- wget curl # just these
```

The replay starts a container, restores the sample files before each example, runs the
example, and compares what it printed against what the page claims. Anything different
fails. The container is destroyed afterwards, so nothing accumulates and no example can
depend on something an earlier one left behind.

The sample files get the same treatment. A page showing you a `report.txt` is showing you a
block that was re-read from the container and diffed rather than a description of it.
Otherwise the data drifts away from the outputs it is supposed to explain.

This runs in CI on every change, alongside the type checks, the link checker and an
accessibility pass. A page whose examples no longer reproduce does not reach the site.

## The limits of the claim

**It means:** this command, on Debian trixie, in a container, with those sample files,
printed exactly this.

**It does not mean:** this is the best way to do the task, this is the only way, or this
will behave identically on your machine. A different Debian release ships different
versions with different output. A container is not a full system: no systemd unless a page
asks for it, no real hardware, no other users.

It also does not mean every block. A page opts into the replay by having a setup script that
puts a container into the state it describes, and the counts above are of the pages that do. A
page that has a script but whose blocks are every one of them exempt is not counted at all.

Where an example needs something a container cannot provide, the page says so rather than
inventing output. The {{exemptions}} exempt examples are ones a batch run cannot supply: a
`tail -f` needing a second process writing to the file, an `ssh` example whose output would
require committing a private key, a request whose answer is your own public IP address. Each
is listed by name in the repository with a note on how it was checked by hand instead.

## Output that cannot be identical

Some useful output contains a value nothing can pin: a process id, an uptime, a
transfer rate, the amount of memory a service is using. Dropping those examples would make
the site poorer, and faking them would make it dishonest.

Those examples are marked. You will see a line above the output reading **"Your output will
differ"**, naming which parts are specific to the machine that produced it. There are
{{volatile}} of them. They are still checked on every run: the numbers are allowed to
move, but a renamed field, a missing line or a changed status still fails the build.

## Why the sample files are checked too

An output is only evidence if you can see what produced it. `wc -l report.txt` printing
`40` tells you nothing unless you know what is in `report.txt`.

So the pages that need it carry their sample files, in a collapsed block above the
examples. Those files are created by a script in the repository, which is what the replay
runs before each example. The block on the page and the script in the repository are
checked against each other, because sample data that has quietly diverged from the examples
is worse than none: it looks like evidence.

## Read it yourself

The generator, the content, the container definition, the replay harness and its tests are
all in one public repository. There is no hidden step.

- [The repository](https://github.com/Synchronium/Debian.tips)
- [The replay harness](https://github.com/Synchronium/Debian.tips/tree/main/scripts): the
  sandbox, the runner, and the code that decides what counts as a match
- [The CI workflow](https://github.com/Synchronium/Debian.tips/blob/main/.github/workflows/ci.yml):
  where it runs on every change
- [This page](https://github.com/Synchronium/Debian.tips/blob/main/content/about.md): every
  figure above is a placeholder in it, filled in from a count of the content at build time

Every other page on the site carries the same list at its foot, naming the files that produced
that page in particular and the one command that re-runs its examples.

If you find an example that does not reproduce on a current Debian system, that is a bug
worth reporting, and one the build should have caught.
