# ADR-0024: The sandbox image is published, and identified by its contents

- **Status:** Accepted
- **Recorded:** 2026-08-27
- **Enforced by:** `scripts/replay/sandbox.sh`, which hashes the build context, checks that hash against
  a pulled image's label as well as its tag, checks that the image's architecture is one this
  daemon can run, and builds when any of those is missing or disagrees;
  `.github/workflows/publish-sandbox.yml`, which publishes both architectures with the tag and
  label the script expects, asking the script for both rather than spelling them out again

## Context

Every page is replayed inside one image (ADR-0020), and that image is the only thing pages share.
Building it is `apt-get update` plus thirty packages.

A runner is always cold, so every replay shard paid for that. Measured over three pushes before
this changed, the build took 18 to 52 seconds with a median around 23, which is about 140 to 180
runner-seconds per push spread across six shards. The Dockerfile changes a few times a year.
`drift.yml` pays it weekly too.

**The spread is the more interesting half of that.** Wall clock is set by the slowest shard, so a
step that is usually 23 seconds and occasionally 52 costs the deploy its worst case rather than
its typical one.

Trimming the build is not the lever. `apt-get update` is 4 seconds and `man-db` another 8; the
rest is the package list, and that list is deliberate. ADR-0020 makes this image the only shared
thing precisely so that no setup script installs its own tool, where it would depend on a network
fetch and pay for it before every example.

There was a prerequisite in the way. `sandbox.sh` decided whether its image was stale by comparing
a label holding **the newest mtime in the build context**. Git does not record mtimes, so a fresh
clone stamps every file with the moment it was checked out: the label said which working copy a
file came from and nothing about what was in it. It could never match an image built anywhere
else, and on CI it had always meant a rebuild, unnoticed because CI built unconditionally.

## Decision

**The image is published to a public registry, tagged with a hash of its build context, and
consumers pull it when they can and build when they cannot.**

- `sandbox.sh` hashes the build context: the contents, paths and modes of every file in it,
  sorted under a fixed collation. The same commit gives the same hash on any machine.
- `.github/workflows/publish-sandbox.yml` builds and pushes
  `ghcr.io/synchronium/debian-tips-sandbox:<hash>` when anything under `scripts/replay/sandbox/` changes.
  It gates nothing and runs beside CI, so no push ever waits on a registry.
- `sandbox.sh build` pulls that tag if it exists, and builds if it does not.
- A pulled image is accepted only when its **label** matches too, not just its tag. A tag is a
  name somebody chose and can be moved or mistyped; the label is what the build recorded about the
  context it came from.
- Both architectures are published, and a pulled image is accepted only when its own is one this
  daemon runs. CI is amd64 and the devcontainer is arm64, and an image for the wrong one is worse
  than none: it pulls with a warning rather than an error, so it passes every other check here and
  fails at the first container.
- The package is public, so no login is needed to pull it. A fresh devcontainer skips the build as
  well as a CI runner.

**Falling back to a build is what makes this a shortcut rather than a dependency.** A registry
outage, a tag nobody published, a mislabelled image, no network: each costs the build that used to
happen every time anyway. The push that changes the Dockerfile still builds on every shard, as it
does today, because the publish for that context has not finished. Every push after it pulls.

## Consequences

**A push spends about 67 runner-seconds less, and reaches the site a little sooner.** Measured on
the first push that pulled: the image step went from 18-28 seconds per shard to 7-16, 136 seconds
to 69 across the six, and the slowest replay job from 124 seconds to 111.

That is a modest saving, and smaller than the build times suggested on their own, because the
slowest replay job is the one carrying the heaviest page rather than the one with the slowest
image step. The steadier claim is the one about spread: the step's tail was 28, 41 and 52 seconds
over three builds, and 16 seconds at worst over a pull. What this mostly buys is a step that no
longer occasionally costs a minute.

**The image the replay uses is now an artifact rather than a build.** That is the real change, and
the content-addressed tag is what keeps it honest: a pulled image is accepted only for the exact
Dockerfile the checkout describes, so "your page starts from the image" (ADR-0020) still means the
image this repository specifies. What is trusted is that GHCR returns what was pushed to it.

**A published image can be wrong in a way a built one cannot.** If a bad image were pushed under a
correct tag *and* label, every consumer would use it. Nothing but the publish workflow can write
that tag, and it builds from the same context it hashes, so this needs the workflow itself to be
wrong rather than the registry.

**`touch scripts/replay/sandbox/Dockerfile` no longer costs a rebuild**, which the mtime label made
certain. A real edit still does.

**The first publish needs a hand.** A package is created private and no API can change that, so
the workflow tries an unauthenticated fetch of what it just pushed and warns when that fails,
leaving somebody to set the package public once. Until then every consumer falls back to building,
which is the old behaviour.

## Revisit when

Revisit if pulling stops being much faster than building, which would mean either that the image
has grown a great deal or that the package list has shrunk to almost nothing.

Revisit if anything starts depending on the pull succeeding. The fallback is the whole safety
argument: the moment a missing image is an error rather than a slower run, a registry becomes
something the site's verification cannot proceed without.
