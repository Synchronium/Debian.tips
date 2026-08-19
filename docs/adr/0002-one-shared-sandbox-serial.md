# ADR-0002: The replay runs serially in one shared sandbox, and the image owns the tools

- **Status:** Accepted, with a deferred follow-up
- **Recorded:** 2026-08-19
- **Enforced by:** `scripts/replay-all.ts`, each page's `scripts/fixtures/<slug>.sh`, `scripts/sandbox/Dockerfile`

## Context

Pages mutate system state. They add apt sources and pins, write `apt.conf` fragments, bind ports,
import GPG keys, create accounts, leave packages in the `rc` state. A page verified on its own in a
clean container proves only that it works in a clean container, which is not the situation it will
be replayed in.

Six real failures here have been exactly this, and **every one of them was invisible to a
single-page run and obvious in the batch**: a port 8080 collision between two pages' mock servers;
apt sources and backports left configured; an `apt.conf` warning suppression leaking into a page
that documented the warning; a GPG default key making `--clearsign` pick the wrong identity; an
`/etc/passwd` line count that changed when another page added a user; `nano` left in the `rc`
state. Two of those exposed defects that were already on the site.

## Decision

`npm run replay` runs every page **serially, in one sandbox per flavour, in a fixed order**.
Fixtures are restored before every single example, because some examples legitimately mutate their
input (`sed -i`, `sort -o`). Each page's setup script normalises what it needs rather than trusting
what it finds.

The corollary, which is easy to get wrong: **tools the site documents are installed in the sandbox
image, not by the page that documents them.** A setup script that installed its own tool would
leave it installed for whatever ran next, and `--changed` replays subsets, so which pages those are
varies by diff. Installing in the image makes the package set identical for every page in every
ordering.

## Consequences

The batch *is* the contamination test. There is no separate assertion that pages do not interfere
with each other; running them all in one container in a fixed order is the assertion.

It is slower than it could be. A full replay is 152 seconds for 40 pages (2026-08-19). CI keeps
pull requests short by replaying only what the diff touches, and a push to `main` always replays
everything, so nothing is deployed on the strength of a partial run.

A page whose examples only pass in a clean container will fail, which is the point, and the fix is
in that page's setup script rather than in the harness.

## Revisit when

A full replay exceeds roughly three minutes of CI wall clock. Parallelising across a pool of
sandboxes is the lever, and it is genuinely a change to *what is tested*: contamination becomes
bounded per pool member rather than exercised end to end, and a page that only fails when it runs
after `apt` would start passing or failing depending on how work was distributed.

Three things must be settled first, in order: per-worker naming for the in-container batch script;
a decision between pinning pages to pool members by slug hash (deterministic, reproducible, still
not the serial order) and accepting non-determinism with a nightly serial run as the authority; and
a replacement for the contamination test, since the batch would no longer be one.
