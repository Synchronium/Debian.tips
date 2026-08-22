# ADR-0004: No documented output may name a machine architecture

- **Status:** Accepted
- **Recorded:** 2026-08-19
- **Enforced by:** `test/architecture.test.ts`

## Context

This project is developed on an `arm64` devcontainer and verified on `amd64` GitHub runners, with
no emulation available locally. Any documented output containing a machine architecture therefore
fails in exactly one of the two places, and which one depends on where you happen to be standing.
That makes it read as a flaky harness rather than as a page that cannot be true everywhere.

Command pages followed this rule by accident for a long time, simply because their examples rarely
printed one. Prose pages had to start following it deliberately.

The failure mode is worse than a red build. `release-channels` used a `verify: skip` whose stated
reason was that the output differed between architectures. That silenced the replay and left the
page showing `[arm64]` to every `amd64` reader for as long as it had existed.

## Decision

No documented output may contain a machine architecture, in any category, on any page.

**The constraint is on the package, not on the command.** A package marked `Architecture: all`
prints `all` everywhere, which is what makes `apt list`, `apt search`, `apt show` and `dpkg -l`
documentable at all. Check before choosing an example package:

```sh
apt-cache show <pkg> | grep ^Architecture:     # "all" is safe, "arm64" is not
```

An exemption whose stated reason is the architecture is rejected outright. That is the defect
itself, not a record of how the example was checked instead.

## Consequences

The `apt` and `dpkg` pages use `cowsay` and `cowsay-off` rather than something more interesting,
because both are `Architecture: all`.

Where an arch-dependent package is genuinely the right example, the output is narrowed instead:
`apt-essentials` uses `dpkg -s nano | head -2` and `apt-cache policy curl | head -3`, because
`nano` and `curl` are compiled and cannot be shown any other way.

A real `apt install` can never be documented at all. Its output carries download sizes, transfer
speeds, the architecture, and dpkg's carriage-return progress lines. The pages simulate with
`apt install -s` instead.

## Revisit when

The devcontainer and CI run the same architecture, or emulation becomes cheap enough to run the
whole replay under both. Neither is close, and the rule is cheap to honour while writing.
