# Voice

What this site's prose sounds like, and what it must not sound like.

It applies to **every sentence this repository publishes**: page bodies and headings under
`content/`, `README.md`, `docs/adr/`, this document and its neighbours, and **code comments**,
which ADR-0017 puts one click away from every page they helped produce.

It does not apply to example captions, `tagline`, frontmatter `description`, `volatile:` notes, or
anything inside an `output:` block. Those are labels and captured text, and they are fine as they
are.

## 1. Permission

Read this before the rules. It matters more than they do.

> You don't need to improve every sentence.
> You don't need to add a transition.
> You don't need to summarise.
> You don't need to explain why something matters.
> You can leave a fact standing on its own.
> You can let a paragraph be short because it is short.
> You can let the reader infer an obvious consequence.

Prose reads as machine-written when everything in it justifies its existence: every paragraph
resolves, every contrast balances, every mechanism arrives at a takeaway. Human writing contains
incidental sentences. The goal is **less patterned**, not less polished.

## 2. The rule that guards the rest

> **These are tendencies, not a template. Do not satisfy every rule in every section.**

A corpus that obeys this document uniformly is the same failure in a new costume: remove the
closing maxims and you get "short opening paragraph, terse final sentence, one dry aside per
section" instead. If three consecutive sections come out shaped alike, one of them is wrong.

Over-editing prose that was already good is the likeliest way to make it worse, and a pass should
expect to leave most sentences alone. A sentence with an actual opinion and an actual causal claim
is doing the job: "the boot path expects dash, and pointing `/bin/sh` at bash to fix one script
slows every script on the system to fix a bug you could have fixed in a line" is not a candidate
for humanising.

## 3. Register

- **A view about a design is allowed. A view about a person is not.** Ubuntu's phasing, apt's two
  front ends, systemd's unit syntax: fair game. The reader: never.
- **Describe what software does. Do not stage a deliberation it never had.** "apt being careful"
  is a judgement about a design; "apt has two choices, break its own rule or leave the package
  alone" invents a decision procedure to manufacture drama.
- **Humour is never an objective.** When a design has a ridiculous consequence, state the
  consequence and leave it. The reader will notice.
- **Never sell, never congratulate, never say "let's", never reassure.**
- **British English**, and never touch a real flag, package name or captured output for spelling.

## 4. The tells

**The aphoristic closer.** A short final sentence restating the section as a portable truth.
Procedure in §6.

**The misconception engine.** *You may think X, actually Y, here is why, therefore Z*, whether or
not anyone thinks X. The test: would a writer have invented this misconception if they weren't
filling a template? If not, cut the setup and state the thing. Real ones stay, and they exist:
"the usual explanation is that these are three settings on one dial" is what people believe.

**Meta-framing.** Promoting a fact into a category before delivering it. Watch for *idea, rule,
difference, message, reason, thing* as sentence subjects. "That rule is the whole feature." Use
"the one thing" only when there is genuinely one thing.

**The summarising tail.** A sentence that has finished its work, then adds a clause re-labelling
what it just said. Any sentence ending "and X is one Y" wants rewriting. `, which is the X` is an
ordinary relative clause and a tell only when it re-labels: keep the ones that add a fact ("which
is the arrangement Ubuntu always uses"), cut the ones that abstract what the reader can already see
("two arguments, neither of which is a file that exists").

**Writing about the document instead of the subject.** The page commenting on itself, on the
reader's progress through it, or on what other documentation gets wrong. State the fact and let it
be the reason the section exists. Naming what other advice gets wrong is fair where it is the
reader's actual problem, which on a troubleshooting page it often is.

**Compression for elegance.** Reaching for the tightest, most balanced formulation when a looser
one is clearer: balanced clauses joined by a bare semicolon where "whereas" or "but" belongs, neat
inversions ("belongs to nothing" for "doesn't belong to anything"), flat certainty where a hedge is
honest ("is about to finish" for "will likely finish"). The instinct being resisted is the one that
makes a sentence pleasing to have written. **The goal is plainness, not length**: padding an
epigram out to avoid sounding neat is this rule misfiring.

**Clefts.** "X is what Y", "what X does is Y", "it is X that Y". Occasionally the right emphasis,
more often a way of making a plain fact sound consequential.

**Soothe-and-reassure.** "Nothing failed. Nothing is broken." Reference documentation does not
manage the reader's emotional state. Delete it and start with what happened.

**The templated opener.** One page may open on a given skeleton. Four may not. Before writing one,
check what the page's category siblings already do.

**Also:** em dashes, `X, not Y` antithesis and symmetry generally, parenthetical asides that answer
a question mid-sentence, and "actually".

## 5. Banned outright

> **Never write "this is the X that matters".**

No exceptions, and the whole family goes with it: *the difference that matters*, *the thing that
actually matters here*, *what really matters is*, *the key thing to understand*, *the real question
is*, *what this really means is*, *at the heart of this*. The construction asserts significance
rather than demonstrating it, and it is among the most recognisable AI tics in English. If a fact
is the important one, its placement and the space given to it say so.

| Also banned | Why |
| --- | --- |
| **load-bearing**, **earns its keep** | Showy where plain description would do |
| **sharper** (of a consequence, a distinction, a rule) | Asserts significance rather than showing it |
| **is real** / **are real** | Claims importance for a fact that can simply be stated |
| **turns on** (as in *it turns on one word*) | Writing about the document |
| *this is where people go wrong*, *what most guides miss* | The same |

**A verbal tic is the other half of this.** Nothing is wrong with "reach for", and the site would
be fine with three of them; forty across fifty pages reads as one author with one gear, which is
exactly the impression being fixed. No frame should repeat more than twice site-wide, and that
applies to phrasing as much as to headings.

The adverbs of obviousness are the group to watch: *plainly*, *clearly*, *simply*, *obviously*, *of
course*. Each tells the reader how apparent something is instead of stating it, so a sentence
usually survives their deletion intact. **A few of each across the site is fine and sounds like a
person**, so count before cutting rather than removing every one on sight. Where the emphasis is
genuinely wanted, the emphatic auxiliary carries it without the adverb: "the loop does run, and the
variable does not change".

## 6. The closer procedure

Per section, in order.

1. **Does the final sentence add information the paragraph above does not carry?** No, so delete
   it. The test is *adds nothing*, not *summarises*: a summary that changes the reader's
   understanding earns its place.
2. **Is it the section's real point, arriving late?** Fold it into the sentence above.
3. **Is it a cross-link, an instruction, or a lead-in to a code block?** Keep. Not a closer.
4. **Has the section earned a stopping point?** A definition, a code example, an observed result, a
   warning or a completed procedure can each end a section with nothing after it.

Guard: if the last sentence were deleted, would the section feel unfinished, and why? "The reader
hasn't been told what to think" means it was an AI closer. "The procedure is incomplete" means fix
the procedure. "The next section depends on it" means move the dependency earlier.

Deleting every closer mechanically produces its own rhythm, and an abrupt stop repeated eighty
times is as recognisable as the maxims were.

## 7. Headings

**A heading names the information in the section, not the rhetorical job the section performs.**
`What it means` describes a function; `Why apt held the package back` describes contents.

Two tests: a heading should still make sense if every paragraph beneath it were deleted, and a
reader scanning only the headings should be able to reconstruct the page.

## 8. In a code comment

Everything above holds. CLAUDE.md's "Writing code here" carries the rules that are specific to
comments: the rule rather than the history, no count or measurement that will move, and names that
describe what a thing is now. What follows is the way a comment goes wrong that a page does not.

- **A figure typed into a comment is a claim nothing checks.** A measurement belongs in an ADR,
  which dates it. `scripts/replay-all.ts` advertised a replay as "about half a minute" while
  ADR-0002 measured 215 seconds, and neither reader would have known to look at the other.
- **A contrast needs the thing it contrasts with.** "What *is* cheap is not paying for a TypeScript
  startup per page" answers a question the comment never asks. It is the aphoristic closer's
  cousin: a shape that sounds like an argument being concluded.
- **Say a fact once.** Two comment blocks explaining the same constraint in different words is a
  page-level repetition compressed into one file, and one of them will be updated alone.
- **Describe the steps in the order the code performs them.** A comment that explains a command's
  second half first is read against the code and lost.
- **Re-read the whole block after editing one line of it.** Comments are edited in place more often
  than prose is, so this is where unfinished sentences collect: `src/content/loader.ts` read "One
  thing still keys off the bare slug and cannot" for as long as nobody read past the first line.

## 9. Before editing a page

A voice edit that puts a sentence between a command fence and its output fence silently
un-verifies the example, and a renamed example title breaks the `.skip` file that names it. Both
are caught, by `test/verificationBaseline.test.ts` and by the replay, but knowing the rule is
cheaper than reading the failure. `.claude/skills/write-content-page/SKILL.md` has the rest of the
constraints, and its §6 is the gate a rewritten page still has to pass.
