# ADR-0002: The replay runs serially in one shared sandbox, and the image owns the tools

- **Status:** Superseded by [ADR-0020](0020-one-container-per-page.md)
- **Recorded:** 2026-08-19
- **Enforced by:** `scripts/replay-all.ts` with `scripts/lib/replayOrder.ts` and `test/replayOrder.test.ts`; each page's `scripts/fixtures/<slug>.sh`; `scripts/sandbox/Dockerfile`; the `replay` and `replay-shuffled` jobs in `.github/workflows/ci.yml`

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

`npm run replay` runs every page **serially, in one sandbox per flavour**. Fixtures are restored
before every single example, because some examples legitimately mutate their input (`sed -i`,
`sort -o`). Each page's setup script normalises what it needs rather than trusting what it finds.

The order within that sandbox is **chosen, not fixed**: `--order=alpha|reverse|random[:seed]`,
defaulting to `alpha`. See "one ordering is not the assertion" below.

The corollary, which is easy to get wrong: **tools the site documents are installed in the sandbox
image, not by the page that documents them.** A setup script that installed its own tool would
leave it installed for whatever ran next, and `--changed` replays subsets, so which pages those are
varies by diff. Installing in the image makes the package set identical for every page in every
ordering.

## Consequences

The batch *is* the contamination test. There is no separate assertion that pages do not interfere
with each other; running them all in one container is the assertion.

**One ordering is not the assertion.** This originally read "in a fixed order", and that claim was
doing more work than it could support: a fixed order exercises exactly one of the possible
orderings, and a page that passes only because of what happened to run before it passes anyway.
Replaying in reverse on 2026-08-21 found a live defect that had been green since the page was
written. `apt-essentials` greps `^The following`, apt prints *two* notices starting that way, and
`remove-vs-purge-vs-autoremove` marking cowsay auto plus the dpkg page's setup purging cowsay-off
was enough to make the wrong one match. Three pages, one direction. Alphabetically the apt page had
already marked cowsay manual before any of it could happen.

So the order is a parameter. `alpha` stays the default and the reference, so that when a shuffled
run fails and the default passes, the difference is the ordering rather than a regression. CI runs
the full site twice on a push to `main`, `alpha` and `random:<commit sha>`, as two jobs on two
runners: genuinely parallel, so it costs no wall clock and no CPU contention. Seeding from the
commit means the permutation varies from commit to commit while re-running a job on the same
commit rolls the same dice, so a failure is reproducible rather than flaky, and the run prints
the argument that repeats it.

It is slower than it could be. A full replay is 215 seconds for 50 pages (2026-08-21). CI keeps
pull requests short by replaying only what the diff touches, shuffled, since that costs nothing
and the pages it reorders are the ones the author just changed. A push to `main` always replays
everything, so nothing is deployed on the strength of a partial run.

The time is concentrated rather than spread: `apt` and `remove-vs-purge-vs-autoremove` are 44% of
the run between them, the top eight pages are 77%, and the median page is 0.72 seconds. Both slow
pages are slow for the same unavoidable reason: they install and remove real packages, and the
restore before each example has to undo it.

A page whose examples only pass in a clean container will fail, which is the point, and the fix is
in that page's setup script rather than in the harness.

## Revisit when

A full replay exceeds roughly three minutes of CI wall clock. Parallelising across a pool of
sandboxes is the lever, and it is genuinely a change to *what is tested*: contamination becomes
bounded per pool member rather than exercised end to end, and a page that only fails when it runs
after `apt` would start passing or failing depending on how work was distributed.

The measurements above argue against doing it early. The ceiling is roughly 3.5x and is set
by one page (`apt`, 50s), so random grouping regularly lands both slow pages together and returns
about 2x. Worse, grouping works directly against the class of defect this decision exists to catch:
the 2026-08-21 failure needed three particular pages in one container, and any split that separates
them hides it. Splitting the work would buy speed by weakening the contamination test rather than
by running the same test faster.

Three things must be settled first, in order: per-worker naming for the in-container batch script;
a decision between pinning pages to pool members by slug hash (deterministic, reproducible, still
not the serial order) and accepting non-determinism with a nightly serial run as the authority; and
a replacement for the contamination test, since the batch would no longer be one.
