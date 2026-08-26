# Architecture decision records

One file per decision that shapes this repository: what was decided, what it rules out, and what
would have to change for it to be worth revisiting.

These records were written on 2026-08-19, and most of the decisions predate them. Several had
been made and re-derived several times without ever being written down anywhere a clone could
see. So each record carries a `Recorded:` date rather than a fabricated decision date. Where the
reasoning came from a review or plan that is not committed, the record is now the only copy.

**This first batch started as a clean slate**, recording only what is currently true rather than
reconstructing decisions that had already been replaced. That was a one-off, to avoid opening the
set with a history nobody needed.

From here the normal rule applies, and which treatment a change gets depends on its size:

- **A decision is reversed or replaced**: write a new record, and mark the old one
  `Superseded by ADR-00NN` with a link. The old record stays. Its reasoning is the most useful
  thing available to anyone wondering whether the new decision has already been tried.
- **A record is merely wrong, stale in detail, or unclear**: edit it in place. Git history is the
  audit trail for that, and a supersession chain over a corrected file name helps nobody.

## What belongs here, and what does not

An ADR states the decision, the alternatives it rejects, and the condition for revisiting. It
stays deliberately short on mechanism.

*How* a thing works lives next to the job that needs it, and these records link to it rather than
restating it:

| For | Read |
| --- | --- |
| How the generator is put together | `.claude/reference/architecture.md` |
| How the verification harness works | `.claude/reference/verification.md` |
| Writing or fixing a content page | `.claude/skills/write-content-page/SKILL.md` |
| The map of everything | `CLAUDE.md` |

Every record names what **enforces** it: the test, the gate, or the schema that fails when the
decision is violated. A record with nothing in that field is a rule nothing is holding up, and
the field is there so that you can see which ones those are.

## The records

### The promise

The site's one differentiating claim is that every output it shows was really produced by the
command shown. These records keep that claim honest.

| # | Decision |
| --- | --- |
| [0001](0001-replay-every-documented-output.md) | Every documented output is replayed against a real Debian container |
| ~~[0002](0002-one-shared-sandbox-serial.md)~~ superseded by 0020 | The replay runs serially in one shared sandbox, and the sandbox image owns the tools |
| [0003](0003-ci-topology-and-gated-deploy.md) | Replay is a separate CI job, and deploy is gated on CI passing the same commit |
| [0004](0004-never-document-an-architecture.md) | No documented output may name a machine architecture |
| [0005](0005-volatile-output-and-exemptions.md) | Output that cannot reproduce exactly is declared, never quietly excused |
| [0020](0020-one-container-per-page.md) | Every page is replayed in a container of its own |
| [0021](0021-every-output-block-is-accounted-for.md) | Every block shown as output is either checked or explained |

### The content model

| # | Decision |
| --- | --- |
| [0006](0006-taxonomy-has-two-axes.md) | `category` is a page's shape, `tags` are its subject, and there are no subcategories |
| [0007](0007-curated-tag-registry.md) | The tag registry is curated, with a two-page rule |
| [0008](0008-command-pages-are-directories.md) | Command pages are a directory with a structured `examples.yaml` |
| [0009](0009-schema-is-the-content-contract.md) | The Zod schema is the single source of truth for what a page needs |

### The generator

| # | Decision |
| --- | --- |
| [0010](0010-hand-written-generator.md) | The site generator is hand-written, with no framework |
| [0011](0011-strict-tsc-instead-of-eslint.md) | Strict `tsc` is the lint config, and there is no ESLint |
| [0012](0012-prettier-never-formats-content.md) | Prettier never formats `content/` |
| [0013](0013-client-js-is-compiled-typescript.md) | Client JavaScript is compiled TypeScript, inlined into every page |
| [0014](0014-minify-css-and-js-never-html.md) | CSS and JS are minified with source maps; HTML never is |

### The design

| # | Decision |
| --- | --- |
| [0018](0018-one-self-hosted-display-face.md) | One self-hosted display face, held to a byte budget |
| [0019](0019-header-nav-is-grouped.md) | The header nav is grouped, not one item per category |

### The gates

| # | Decision |
| --- | --- |
| [0015](0015-link-integrity-is-two-gates.md) | Link integrity is two separate checks, not one |
| [0016](0016-accessibility-is-a-gate.md) | Accessibility is a build gate, and its URL list is generated |
| [0017](0017-every-page-links-to-its-own-sources.md) | Every page links to the files that produced it |
| [0022](0022-no-snapshot-tests-and-no-pixel-baselines.md) | No snapshot tests and no pixel baselines; the gates assert named properties |

## Adding one

Copy the shape of any existing record: a `Status` / `Recorded` / `Enforced by` header, then
**Context**, **Decision**, **Consequences**, **Revisit when**. Number it sequentially, add it to
the table above, and say what enforces it. If nothing does, say that too: it is useful
information about how much the decision is worth.

`Status` is `Accepted` unless there is something to say (`Accepted, pending an upstream release`;
`Accepted, with a deferred follow-up`). A record that has been replaced becomes
`Superseded by [ADR-00NN](00NN-….md)`, and the superseding record says which one it replaces in its
Context. Leave the superseded record otherwise intact, since rewriting its reasoning to match the
new decision destroys the only thing it is still good for.

The tables above carry no status column, so mark a superseded row in place
(`~~0011~~ superseded by 0021`) rather than leaving it reading as current.
