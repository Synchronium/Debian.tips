# ADR-0017: Every content page links to the files that produced it

- **Status:** Accepted
- **Recorded:** 2026-08-21
- **Enforced by:** `test/sourceLinks.test.ts` and `test/pageChecks.test.ts`, in `npm run check`

## Context

[ADR-0001](0001-replay-every-documented-output.md) commits the site to a claim: every documented
output was produced by the command shown, and is produced again on every change. A claim of that
shape is only worth making if a reader can check it, and until now checking it meant four steps
none of which the site helped with — read `/about/`, find the repository, work out where a page of
that category lives on disk, then guess that its setup script is named after its slug.

Every one of those steps is a convention this repository knows and a reader does not. The evidence
existed and was public; the route to it was folklore.

The site also distinguishes, carefully and in public, between pages the replay covers and pages it
does not — `/about/` counts what is automated rather than what is intended, and names the pages
nothing re-runs. That distinction was visible only in aggregate, as a number on one page, and not
on the page it was actually about.

## Decision

Every *content* page — everything under a category, which is everything with examples to re-run —
carries a block at its foot naming the files in this repository that produced it, each linked, and
the single command that re-runs its examples.

The standalone pages are the exception, and `/about/` is currently the only one. It has no examples,
so the block's replay command and its figures would both be empty, and the "no setup script yet"
wording would be actively wrong. It links its own sources in its prose instead, under "Read it
yourself" — and `test/sourceLinks.test.ts` holds those hand-written links to `SITE.repo` for the
same reason it checks the generated ones.

`src/content/sourcePaths.ts` derives the paths from the page's category and slug using the helpers
in `src/paths.ts` — prose or `index.md` plus `examples.yaml`, then `scripts/fixtures/<slug>.sh` and
`scripts/fixtures/<slug>.skip` where those exist. The loader puts the result on every `Page`, so
the templates render data rather than reaching into the filesystem themselves.

A page with no setup script gets different words rather than a hidden block. It says that nothing
re-runs its examples, and names the file that would change that. Printing `npm run replay -- <slug>`
on a page the replay reports as unverified would be a command that does not do what the sentence
above it claims.

Beside the command, the page states what that command will check: how many outputs, how many of
those are compared by shape rather than byte for byte, and how many are exempt. The figures come
from `src/content/pageChecks.ts`, which is also what `scripts/replay-command-page.ts` partitions on
and what `/about/` sums — one definition, so a page cannot advertise a number the command
contradicts. Counting them in the template instead would have made a fourth copy of "what does this
page check", which is the same mistake `src/content/replaySkips.ts` was extracted to undo.

Three of the four sentences that produces are for cases that are easy to forget: output compared by
shape, output that is exempt, and a page that checks nothing at all because every one of its blocks
is exempt. That last state is one `/about/` deliberately leaves out of both its page counters, so
until now no page in it said so.

The repository URL is `SITE.repo` in `src/config.ts`, and `blobUrl()` beside it is the only
sanctioned way to turn a path into a link. The footer used to spell the URL out; it no longer does.

## Consequences

**A third class of link, and neither existing gate can reach it.** ADR-0015 records two checks:
`src/linkcheck.ts` resolves internal links against `dist/`, and `scripts/link-audit.ts` reasons
about the page graph. Neither fetches anything, and neither should — a build that depends on
github.com being up is a build that fails for reasons unrelated to the change. So a renamed setup
script, or a page moved between categories, would put a dead link on every page carrying it, and
nothing would notice.

`test/sourceLinks.test.ts` stands in for the check a link checker cannot run: it asserts every
generated path resolves in the working tree, that the paths are repository-relative with forward
slashes, and that `replayable` and `hasSkipFile` are each true exactly when the file they name
exists. It also asserts the hand-written GitHub links in `content/about.md` sit under `SITE.repo`,
since Markdown cannot read the constant and would otherwise be left behind by a move.

**Where the block says an exemption is explained depends on the kind of page**, and getting it
wrong is not a wording slip. A command page records an exemption in `scripts/fixtures/<slug>.skip`,
listed among the files; a prose page records it inline, in a `<!-- verify: skip … -->` comment the
Markdown pipeline strips before rendering — so for those readers the page source is the only place
it exists. Telling a reader to consult a skip file that was never written sends them away
empty-handed from the one block whose job is to make the claim checkable. `PageSources.hasSkipFile`
is what the two sentences are chosen on, and `test/sourceLinks.test.ts` asserts the file each
sentence names is one the page actually lists.

**The block is excluded from search.** It is the same paragraph on every page, and inside
`data-pagefind-body`. Indexed, it made "container", "repository" and "replay" match all 50 pages
equally; `data-pagefind-ignore` puts the word count back exactly where it was.

**Naming an unverified page on the page itself.** This is the point rather than a cost, but it is
worth being deliberate about: a page written ahead of its fixture now says so to its readers, not
only to a counter on `/about/`. The pressure that creates is the pressure the site wants.

**A page's figures are a claim like any other.** They are counted from what the page carries, not
from a replay run — the build has no sandbox. That is the same basis `/about/` has always used, and
it holds because the replay passes; the numbers are what the command *will* print, which is exactly
what makes them worth checking. `test/pageChecks.test.ts` asserts the per-page figures fold up to
the site totals, that each of the four sentence shapes is exercised by real content, and that
by-shape is not quietly conflated with `volatile:` — two figures close enough in meaning to be
merged by someone tidying up, and answering different questions.

**A page's provenance is now part of the page.** Moving content between categories, renaming a
slug, or splitting a command page changes what the block says, and the test fails until the block
is right. That is a small tax on restructuring and the reason the links can be trusted.

## Revisit when

The repository moves, is mirrored, or gains a second branch worth linking to — `blobUrl()` pins
`main`, which is right for a site deployed from `main` and wrong the moment that stops being true.

Also revisit if a page ever needs to name a file that is not derivable from its category and slug.
The derivation is what makes the test cheap; an escape hatch in frontmatter would move the failure
back to where nothing checks it.
