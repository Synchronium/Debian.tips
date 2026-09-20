# Voice

What this site's prose sounds like, and what it must not sound like.

It applies to **every sentence this repository publishes**: page bodies and headings under
`content/`, example captions and section intros, `README.md`, `docs/adr/`, this document and its
neighbours, **code comments**, which ADR-0017 puts one click away from every page they helped
produce, and **commit messages**, which this project writes at length and GitHub publishes beside
the code.

The one exception is text that was captured rather than written. Anything inside an `output:` or
`fixtures:` block is what a command printed, and editing it for style would be falsifying it.

**A caption is a hard case, not an exempt one.** `title`, `tagline` and frontmatter `description`
are short and constrained, so most of §4 has no room to appear in them, but §3 and §5 hold
everywhere: a tagline can still assert significance instead of showing it. An example
`description` is a sentence or three of ordinary prose and is held to all of this. Note that the
existing corpus was audited across its page bodies but only partially across its captions, so a
caption that reads like a section closer is more likely to predate this document than to be
sanctioned by it.

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

Epigrams are the conspicuous form and not the common one, so a pass that looks only for them will
call a page clean. The everyday form is grammatical ellipsis: a dropped relative pronoun ("a path
it has never had" for "a path that does not exist"), a gerund where an infinitive reads better
("the fix is waiting, or using a different mirror"), an appositive smuggling in a judgement ("A
different error, and progress:"), a colon standing in for the clause that would explain the link
("the reason is dull: the index is old"). Each saves a word and costs the reader a second pass.

**`, and` where the clauses are not equals.** "arrives as two items, `last` and
`week.log`, and the command runs against two names that do not exist" flattens a causal chain into
a list. `, so` states the relationship the sentence actually has. A contrast is the same fault
facing the other way, and it is the easier one to miss once you are hunting for the first: "a
version exists and apt has decided against it", "an arrangement it is willing to make and declines
to make it", "apt splits its answer across the two streams, and everything quoted above is standard
output". Those want `but`. This is frequent enough to be worth a pass of its own, and a pass
looking only for consequences finds about half of what is there: leave the `, and` that joins
genuine equals, and change the ones joining a cause to its effect, or a claim to its
qualification.

That pass is the one most often skipped, because nothing fails without it and the sentences read
acceptably to the person who wrote them. A review of three pages written in one sitting returned
eight of these and five of the ellipsis above, both from an author who had read this section that
morning. Neither has a spelling `npm run voice` can find, so a page gets them only from somebody
reading it whole and cold.

**Clefts.** "X is what Y", "what X does is Y", "it is X that Y". Occasionally the right emphasis,
more often a way of making a plain fact sound consequential.

**Soothe-and-reassure.** "Nothing failed. Nothing is broken." Reference documentation does not
manage the reader's emotional state. Delete it and start with what happened.

**The templated opener.** One page may open on a given skeleton. Four may not. Before writing one,
check what the page's category siblings already do.

**The numeral-led opener.** A caption that begins by counting what follows: "Three answers for one
word", "One line, from the section you asked for", "Three directories, searched in order", "None of
the first four is the `passwd` command". The count is seldom what the reader needs first, and six of
them on a page is a house style rather than six observations. Say what the thing is, and put the
number where it does some work or leave it out. `npm run voice` counts these against a budget,
being one of the few tells in this section with a spelling.

**The epigram where the mechanism goes.** A sentence with the cadence of a conclusion, standing in
for the explanation the reader came for: "answers a question nobody asked", "the second search is
honest", "reported it to an empty room", "one transposition, and it would have survived". The test
is to delete it. If no fact goes with it and the paragraph is now missing something, the sentence
was holding a place rather than filling one.

It matters more here than the other tells for two reasons. A reader who cannot follow a sentence
has no way to tell whether it was wrong or merely compressed, and whether the claims are true is
the whole of what this site sells. And the shape is invisible to the replay, which checks output
blocks and figures while a phrase that merely sounds conclusive passes untouched: that is how
`#!/usr/bin/env python3` came to be described here as surviving a typo it does nothing about, and
the sentence read well enough that the error reached review rather than being caught in writing.
Ask what a reader would need in order to reconstruct the claim, and write that. Extra words are
allowed; §1 gives permission not to pad, which is not permission to leave out the step that makes
a claim follow.

**The positional half.** Setting something up as two parts and then pointing at one of them by
position: "`CONT` is the other half", "The other half of the question", "This half of `-p`". The
reader has to carry the mapping to use the sentence, and where the antecedent is in a different
example there is nothing on screen to map it to. Name the part instead, which is usually shorter:
"`CONT` is what undoes `STOP`". Saying first, second or both is a fair substitute and nothing
counts those, so the budget is only for the positional form. What the rule leaves alone is the word
used honestly: `half-finished` and its family, the quantity sense, and a thing that really is two,
like a key pair's public and private halves or the master and slave of a pty.

The same habit points at an example rather than a part: "for the reason the third one shows",
"the case `-0` above exists for", "every other case on this page". A page is read in fragments,
linked to from the middle and scrolled past, so a reference that depends on where the reader is in
it costs them a trip. Name the thing. Nothing counts these either.

**Negation carried on the wrong word.** "No repository apt knows about lists a package by that
name" asks the reader to hold a negative through eight words before learning what it denies, and
"None of the repositories apt knows about lists" does not. The family shares that shape: "and
nowhere else" for "only", "a machine nobody upgraded" for "a machine that has not been upgraded",
"neither is interesting" for a judgement better cut than compressed. It is next door to the tell
below and not the same one: there the complaint is that an absence has been made the subject, here
that a real subject has been made to carry a negative it does not need.

**An absence as the actor.** Making "nothing" the subject of a verb where naming the actor or
negating the verb is shorter and plainer: "nothing checks it" for "it is not checked", "nothing
holds the file" for "no process holds it", "nothing refuses a write" for "the kernel does not
refuse a write". It reads as a sentence that wanted a subject and had none to hand, and it
collects: three pages written in one sitting carried twenty-one of them, against a corpus rate of
half that. The object position is the same habit facing the other way, "frees nothing" for "frees
no space at all", though there the honest uses outnumber the tell and no rule counts them.

What this leaves alone is the word used plainly. "nothing but", "has nothing to do with" and "look
nothing alike" are fixed phrases. The passive "nothing is printed" has no actor to name and is how
half the corpus describes a quiet command. "Four megabytes used by nothing `du` can find" and
"points at nothing, and never at half a file" both mean the absence exactly. `npm run voice`
counts the subject form against a budget and cannot see any of these distinctions, so a finding is
a line to read rather than a line to change.

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

**A verbal tic does the same damage.** Nothing is wrong with "reach for", and the site would
be fine with three of them; forty across fifty pages reads as one author with one gear, which is
exactly the impression being fixed. No rhetorical frame should repeat more than twice site-wide,
and that applies to phrasing as much as to headings, with the exception §7 sets out.

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

**A standard section name is not a frame, and should repeat.** `## Common misconceptions`,
`## Go deeper`, `## Variations`, and the Problem / Solution / How it works spine of a recipe are
navigation: a reader who learns the shape on one page can find that section on every page that
has one. Reaching for a synonym to avoid the repetition makes the site harder to scan without
making it any less patterned, so use the established name wherever the section genuinely exists,
and check what sibling pages call it before inventing one.

The repetition rule is about rhetorical frames instead: `## The mental model: X`, `## A note on
X`. Those announce how to read a section rather than naming what is in it, which is why a third
and fourth of them read as a template.

## 8. In a code comment

Everything above holds. CLAUDE.md's "Writing code here" carries the rules that are specific to
comments: the rule rather than the history, no count or measurement that will move, and names that
describe what a thing is now. What follows is the way a comment goes wrong that a page does not.

- **A figure typed into a comment is a claim nothing checks.** A measurement belongs in an ADR,
  which dates it, or in the command that prints it. `scripts/replay/all.ts` advertised a replay as
  "about half a minute" while ADR-0002 had timed the same run at several times that, and neither
  reader would have known to look at the other.
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

## 9. What the checker covers

`npm run voice` reads this document's lexical half: everything §5 bans outright, and em dashes.
Those are failures, and the corpus sits at zero, so a finding is something newly written. It also
counts the phrases that are fine a few times and wrong as a habit, against a budget, which only a
whole-corpus pass can judge. A `PostToolUse` hook runs it on each file as it is written, so a
banned construction comes back in the same turn it was typed.

**Over the whole of what this document claims**, which means `content/`, `docs/`, `.claude/`,
`README.md`, `CLAUDE.md`, and the comments in `src/`, `scripts/` and `test/`. In a source file it
reads whole-line comments and nothing else: a banned phrase inside a string literal or a regular
expression is data, and `scripts/gates/voice-check.ts` quotes every phrase it bans. `test/fixtures/` is
exempt, because those bytes are what the build tests compare against and a fixture is a stand-in
rather than prose.

**A green run says nothing about §4.** The tells that are shapes rather than spellings, a closer,
a manufactured misconception, a section that comments on itself, are invisible to it, and the one
rule that was tried both ways proves the boundary: `, and` joining a consequence matched hundreds
of lines across the corpus with almost no true positives, because whether a clause follows from the
one before it is a question about meaning. The contrastive form is no more tractable, and neither
is the ellipsis above. Those still need the page read.

## 10. Before editing a page

A voice edit that puts a sentence between a command fence and its output fence silently
un-verifies the example, and a renamed example title breaks the `.skip` file that names it. Both
are caught, by `test/verificationBaseline.test.ts` and by the replay, but knowing the rule is
cheaper than reading the failure. `.claude/skills/write-content-page/SKILL.md` has the rest of the
constraints, and its §6 is the gate a rewritten page still has to pass.
