# ADR-0017: Every page links to the files that produced it

- **Status:** Accepted
- **Recorded:** 2026-08-21
- **Enforced by:** `test/sourceLinks.test.ts`, in `npm run check`

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

Every page carries a block at its foot naming the files in this repository that produced it, each
linked, and the single command that re-runs its examples.

`src/content/sourcePaths.ts` derives the paths from the page's category and slug using the helpers
in `src/paths.ts` — prose or `index.md` plus `examples.yaml`, then `scripts/fixtures/<slug>.sh` and
`scripts/fixtures/<slug>.skip` where those exist. The loader puts the result on every `Page`, so
the templates render data rather than reaching into the filesystem themselves.

A page with no setup script gets different words rather than a hidden block. It says that nothing
re-runs its examples, and names the file that would change that. Printing `npm run replay -- <slug>`
on a page the replay reports as unverified would be a command that does not do what the sentence
above it claims.

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
slashes, and that `replayable` is true exactly when the setup script exists. It also asserts the
hand-written GitHub links in `content/about.md` sit under `SITE.repo`, since Markdown cannot read
the constant and would otherwise be left behind by a move.

**The block is excluded from search.** It is the same paragraph on every page, and inside
`data-pagefind-body`. Indexed, it made "container", "repository" and "replay" match all 50 pages
equally; `data-pagefind-ignore` puts the word count back exactly where it was.

**Naming an unverified page on the page itself.** This is the point rather than a cost, but it is
worth being deliberate about: a page written ahead of its fixture now says so to its readers, not
only to a counter on `/about/`. The pressure that creates is the pressure the site wants.

**A page's provenance is now part of the page.** Moving content between categories, renaming a
slug, or splitting a command page changes what the block says, and the test fails until the block
is right. That is a small tax on restructuring and the reason the links can be trusted.

## Revisit when

The repository moves, is mirrored, or gains a second branch worth linking to — `blobUrl()` pins
`main`, which is right for a site deployed from `main` and wrong the moment that stops being true.

Also revisit if a page ever needs to name a file that is not derivable from its category and slug.
The derivation is what makes the test cheap; an escape hatch in frontmatter would move the failure
back to where nothing checks it.
