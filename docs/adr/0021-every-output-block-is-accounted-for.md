# ADR-0021: Every block shown as output is either checked or explained

- **Status:** Accepted
- **Recorded:** 2026-08-26
- **Enforced by:** `replayProsePage` in `scripts/replay-prose-page.ts`, `proseChecks` in
  `src/content/pageChecks.ts`, `test/pageChecks.test.ts`, the `exempt` and `unpaired` figures in
  `test/verification-baseline.json`

## Context

A prose page states an example as a ```` ```bash ```` fence followed by the output it produced, and
`src/content/proseBlocks.ts` pairs the two when the output fence opens on the line immediately
after the command fence closes. That pairing is what makes the block checkable.

There were two ways for a block to end up unchecked, and they were held to very different
standards.

`<!-- verify: skip <why> -->` above a pair refused to run without a reason, counted into the
page's `exempt` figure, was summed onto `/about/`, and produced a sentence at the foot of the page:

> 2 more are exempt; the page source above says how each was checked instead.

An output fence with no command fence above it needed none of that. The parser reported it as a
number, the replay printed "N block(s) not checkable", and nothing else in the site had an opinion
about it. It was counted into no figure a reader sees.

So `/troubleshooting/repository-is-not-signed/` rendered seven blocks inside a
`<pre aria-label="output">` and said, at its own foot, "Checks 4 outputs".
`/troubleshooting/sudo-command-not-found/` rendered ten and said eight. The three and the two were
legitimate content in both cases, but the page did not say they existed, and the mechanism for
saying so was sitting unused a few lines away.

This was not an unguarded regression. `scripts/lib/verificationBaseline.ts` already recorded
`unpaired` per page with `direction: mustNotRise`, so the count could not grow unnoticed and a
broken pair still announced itself. The ratchet protects the repository. The sentence at the foot
of the page is what protects the reader, and only one of the two knew these blocks were there.

## Decision

**An output fence with no command above it must carry `<!-- verify: skip <why> -->`, and is
counted as exempt.** `replayProsePage` refuses the page otherwise, with the same error it already
raised for an unexplained `skip` on a pair. The two spellings are now one discipline: whichever
way a block goes unreproduced, it says why in the page source, and the page's footer counts it.

**A block that is not output does not use a bare fence.** The rule above only makes sense for
things presented as output. A `.sources` stanza the reader is told to write is not output, and
routing it through the exemption mechanism would have made the footer claim something new and
false: that the page documents an output nothing reproduces. Those carry a language tag (` ```ini `
for the deb822 stanzas on `/debian/release-channels/`), which takes them out of the unpaired set
because the parser only ever considered bare fences.

`src/content/markdown.ts` labels a block for assistive technology by what it is, and now has three
answers rather than two: a bare fence is `output`, a `bash` fence is a `command`, and anything else
is an `<lang> file`. Calling a config stanza a command was telling a reader to run it.

`/about/`'s `{{exemptions}}` now sums both kinds, so the total is the sum of the per-page figures
it is presented as being.

## Consequences

Every block a reader is shown as output is either re-run on every push or has a written reason
beside it saying why not, and the number at the foot of the page is the whole of what the page
shows. `test/pageChecks.test.ts` asserts that against the rendered markup rather than against the
parser, which would only restate its own arithmetic.

The cost falls on authoring, and it is small but real: a troubleshooting page that opens by quoting
the error the reader arrived with now needs one comment line saying why that quote is not
reproduced. That is usually the most honest sentence on the page, since the error is the one thing
the page cannot make its own machine print.

`unpaired` stays in the baseline as a separate figure even though it is now a subset of `exempt`.
It answers a different question: `exempt` going up means a page checks less, while `unpaired` going
up specifically means a *pair broke*, which is what happens when a voice edit puts a sentence
between a command fence and its output. Folding it into `exempt` would lose the one signal that
names the cause.

`ProsePage.unpaired` is the blocks rather than their count, which `test/architecture.test.ts` also
needed: it scans every documented output for a machine architecture, and could not see inside
these until they were returned.

## Revisit when

A page wants a third state: an output block that is genuinely uncheckable and also not worth
counting as an exemption. Nothing needs one today, and inventing it before something does would
give an author a way to opt out of both figures at once, which is what this record exists to close.
