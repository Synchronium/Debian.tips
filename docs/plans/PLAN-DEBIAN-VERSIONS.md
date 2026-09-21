# Debian versions

Notes on what this site should do about Debian releases: the one it targets now, the ones it does
not, and the one that has not happened yet. Working notes rather than a decision. Nothing here is
an ADR, and none of it has been built.

Started 2026-08-24. §3 is an experiment run that day; every number in this document comes from it
rather than from reasoning about what probably differs. §2.4 was added on 2026-09-13, and comes
from a live failure rather than an experiment.

## §1. The short version

Three findings, in the order they change the answer.

1. **The image pin does not protect the site.** Three clocks run independently, and only one of
   them is pinned. §2. The unpinned one is not a future problem: it has already turned two pages
   red on `main` without either page being touched. §2.4.
2. **The differences between releases are small and concentrated.** 96.2% of the site's examples
   reproduce byte for byte on a release two years older, untouched. 14 of 25 pages are identical.
   §3.
3. **Which means the expensive option is the wrong one.** Maintaining a copy of each page per
   release would duplicate 25 pages to capture differences that exist in 11, and 44% of those
   differences are a version number inside a `User-Agent` header. §5.

The recommendation in §7 is per-example rather than per-page, staged so that the first stage is
worth doing on its own even if none of the rest follows.

## §2. What actually happens when forky is released

No build fails, and no page changes. The site simply stops being about the release people run.

### §2.1. Three clocks, one pin

| What | Pinned? | Where |
|---|---|---|
| The sandbox base image | **yes**, `FROM debian:trixie` | `scripts/replay/sandbox/Dockerfile`, `scripts/replay/sandbox.sh`, `.devcontainer/devcontainer.json` |
| The archive metadata the image fetches at run time | **no** | `deb.debian.org`, rewritten by Debian |
| The claim that this is current Debian stable | **not encoded anywhere** | the homepage, `about.md`, `release-channels` |

The first is pinned, so the replay keeps passing. The third is prose no gate checks. The second
changes underneath a pinned image without anyone touching this repository.

### §2.2. The suite label is a dated, unavoidable breakage

`apt search` and `apt list` print a suite label taken from the `Suite:` field of the archive's
`Release` file. That field is assigned by the archive, not by the image. Verified 2026-08-24:

```
trixie   → Suite: stable
bookworm → Suite: oldstable
```

The `apt` page documents output containing `cowsay/stable,now`. The day forky is released,
`deb.debian.org` rewrites trixie's `Release` file to say `oldstable`, and **four examples on the
apt page start failing without a byte changing in this repository**. Confirmed by replaying the
apt page against bookworm, where those four already fail for exactly this reason.

This is not a question about supporting multiple versions. It is a fault in the current site, with
a due date, that the current gates cannot see coming.

### §2.3. What else goes stale on that day

- `release-channels` names trixie as stable and bookworm as oldstable. Both become wrong.
- `about.md` and the homepage claim current stable.
- The devcontainer and sandbox keep targeting a release that is no longer what a reader is
  running, and every gate stays green while the site's central claim quietly stops being true.

**None of this fails a build.** The verification harness answers "do these commands produce this
output", which is a question about the pin. It never asks whether the pin is still the right one.
Closing that gap is cheap: a check comparing the pinned codename against what the archive
currently calls stable, failing when they diverge. That makes the staleness visible on the day it
starts rather than whenever somebody happens to notice.

### §2.4. The unpinned clock does not wait for forky

The archive row in §2.1 is already costing the site pages, and the mechanism is a point release
rather than a new suite. On 2026-09-13 the full replay on `main` went red on three pages that
day's merges never touched. Two had one cause: Debian published a stable update, `perl
5.40.1-6+deb13u1` and the packages that came with it, into the suite the pinned image installs
from.

- `apt-upgrade-vs-full-upgrade` teaches what `upgrade` and `full-upgrade` are each willing to
  disturb, against a fixture repository built for the purpose. Real pending upgrades show up in
  exactly the output it is teaching, so the page listed `base-files gzip libext2fs2t64 perl` where
  it means to list two `tips-` packages.
- `list-installed-packages` taught the `[installed]` versus `[installed,automatic]` bracket using
  `perl-modules-5.40`, whose bracket became `[installed,upgradable to: …]`.

Both were repaired structurally rather than re-captured. The first fixture moves Debian's own
sources aside before `apt-get update`, leaving the local repository that is the page's whole
subject; the second contrasts `cowsay-off` against a `cowsay` the fixture marks automatic itself.
The shared rule is worth stating on its own, because honouring it while writing a page is far
cheaper than finding it later: **a page asserting a real package's state is asserting that Debian
has not patched it.** Build the state the page needs; do not read the state the image happens to
be in.

The rest of that class is still out there and no gate can list it. `list-installed-packages` prints
the installed size of `perl-modules-5.40` a few examples further down, which is true today and
drifts the same way. Re-capturing it on a guess about the future would be worse than leaving it,
so it is written down here instead.

**This class is found late by construction.** A pull request replays only the pages its diff
touches, which is the right trade for the time it saves, but a page nobody edited is not in that
set. Only `main` replays the whole site, so the first report arrives after the merge and names
pages the merge had nothing to do with.

Three ways out, none of them chosen yet:

| Option | What it costs |
|---|---|
| Pin the archive too, against `snapshot.debian.org` | Makes the pin mean what §2.1 claims. Moving the snapshot becomes a deliberate commit that re-replays the site, which is the point, and the sandbox then stops seeing security updates the reader's machine has. |
| `apt upgrade` at image build | The image becomes internally consistent, so pending upgrades stop appearing in output. Version strings printed by pages then follow the archive instead, so this moves the drift rather than ending it. |
| Keep fixing pages as they break | What happens today. Cheap per incident, and each fix leaves a page less dependent on the archive, but the bill lands on `main` after a merge and reads at first glance like the merge broke something. |

Choosing between them is ADR-shaped: it decides what a replay result means, which is a constraint
on every page rather than a preference. Stage 1 in §7 is the neighbouring check and not the same
one, since it compares codenames and would stay green through all of this.

## §3. The experiment

Rather than reason about what probably differs, the site was replayed against bookworm.

**Method.** A second sandbox image built from the existing `Dockerfile` with `FROM debian:trixie`
changed to `FROM debian:bookworm`, then every command page with a setup script replayed against
both, using the normal harness and the pages' own fixtures. 25 of the 27 command pages:
`systemctl` and `journalctl` were excluded because they need the systemd sandbox, which this run
did not stand up.

One incidental finding from the build. **The image definition is not version-portable**: the
`systemctl mask` line fails on bookworm, where `systemctl` is not present in the base image, so
the build aborts. Any multi-version work starts by making that Dockerfile conditional.

**Result.**

| | trixie | bookworm |
|---|---|---|
| Documented outputs reproducing | **885 / 885** | **851 / 885** |
| Pages byte-identical | 25 / 25 | **14 / 25** |

**96.2% of the site's examples reproduce unchanged on a release two years older**, with no edits,
no masking and no per-version content.

The failures concentrate hard. Four pages (`apt`, `curl`, `dpkg`, `wget`) account for 25 of the
34, or 74%. The eleven pages that differ at all: apt 8, curl 9, dpkg 4, wget 4, ssh 2, wc 2, chmod
1, crontab 1, jq 1, sort 1, tar 1.

The fourteen that are identical: awk, cowsay, cut, diff, find, grep, head, ls, sed, tail, tee, tr,
uniq, xargs. Text processing and file handling do not move between releases.

## §4. What the differences actually are

All 34, classified by what would have to be done about each.

### §4.1. Version strings in output: 15 of 34 (44%)

```
page: "User-Agent": "curl/8.14.1"      real: "curl/7.88.1"      (9 examples)
page: "User-Agent": "Wget/1.25.0"      real: "Wget/1.21.3"      (4)
page: OpenSSH_10.0p2 … OpenSSL 3.5.6   real: OpenSSH_9.2p1 …    (1)
page: ca-certificates 20250419         real: 20250419~deb12u1   (1)
```

Cosmetic, and the largest single class. The harness already has `MASK_TOKENS` for exactly this
shape of difference. **Nine of these are one cause**: the curl page's mock HTTP server echoing the
request's `User-Agent` back. Masking version strings would take bookworm from 96.2% to about 97.9%
on its own.

### §4.2. The feature does not exist in the older release: 4

```
wc --total=always / --total=never   → "unrecognized option"   (coreutils 9.2; bookworm has 9.1)
chmod -h                            → "invalid option"
ssh obscurekeystroketiming          → absent                  (OpenSSH 10; bookworm has 9.2)
```

Not maskable and not a defect. The page documents something genuinely newer than the older
release. This is the class that per-version content is actually *for*, and there are four of them
across the whole site.

### §4.3. Message or output text changed: 5

```
apt:  "Installing:" / "Summary:"   ↔  "The following NEW packages will be installed:" /
                                       "0 upgraded, 0 newly installed, 0 to remove…"
jq:   "jq: parse error: …"         ↔  "parse error: …"
sort: "sort: numbers use…"         ↔  "sort: note numbers use…"
```

The apt ones matter most: **apt 3.0 (trixie) redesigned its output** and bookworm's apt 2.6 prints
whole different sentences. This is the single case in the whole corpus where a reader on the older
release would be genuinely misled rather than mildly inconvenienced, and it is the strongest
argument in the data for doing anything at all here.

### §4.4. Suite label: 4

`stable` versus `oldstable`, per §2.2. Archive-driven rather than release-driven, which is why it
is the one class that will hit the *current* target too.

### §4.5. Packaging and system-layout drift: 5

```
dpkg -S /usr/bin/gzip     → "no path found matching pattern"   (the /usr merge)
dpkg -s bash-completion   → a different Conffiles list
dpkg -l bash-completion   → 1:2.11-6 rather than 1:2.16.0-7
apt remove -s cowsay      → libtext-charwidth-perl in the dependency set, gone in trixie
crontab                   → a different default PATH ordering
```

The `dpkg -S` one is the most interesting: on bookworm the dpkg database still records
`/bin/gzip`, so a page teaching "find which package owns a command" gives the wrong answer on the
older release for a structural reason. A real content difference rather than cosmetics.

### §4.6. Byte-level drift: 1

`tar` with xz produces 300 bytes on bookworm against 308 on trixie. Different compressor version,
same input. Already the kind of thing `compare: shape` exists for.

### §4.7. What this taxonomy implies

Of 34 differences: **15 are cosmetic** (§4.1), **1 is already covered** by an existing mechanism
(§4.6), and **18 are genuine differences** (§4.2 to §4.5) across 11 pages. Eighteen genuine
content differences across a two-year release gap and 885 documented outputs is small, and any
design here has to be proportionate to it.

## §5. What the data rules out

**Maintaining a copy of every page per release is refuted by these numbers.**

- 14 of 25 pages would be exact duplicates, kept in sync by hand forever, to record no difference
  at all.
- The 11 that differ mostly differ in one or two examples out of 40 or 60. The `curl` page differs
  in 9 of 28, and all nine are one string.
- Cost scales as pages × releases. Today that is 56 × 2. The content plan's backlog is ~170 pages;
  at four supported releases that is ~680 page-versions, each needing its own replay. The full
  replay is already about four and a half minutes for 56 pages.
- Every duplicated page is a place for the two copies to drift in ways no gate detects, because
  they are separate files and no gate compares them.

The framing of the alternative as a base page plus diffs is the right instinct, and it points at
the answer: **store the diff rather than two copies.** But at 18 differences site-wide, the
natural unit for that diff is the example rather than the page.

There is also a search problem that is independent of maintenance cost. The largest persona
(§10.1) arrives from a search result. A header control that changes what every page says either
serves different content at one URL, which is bad for the search arrival and worse for indexing,
or creates N URLs per page of near-duplicate content, which search engines handle by picking one
and ignoring the rest.

## §6. The options, against the evidence

| Option | Verdict |
|---|---|
| **(a)** A sentence: "also works on Debian N-1" | Too coarse and, on 11 of 25 pages, false. Would need to be per-page, and then it is (b). |
| **(b)** Per-page tick/cross table | Honest and cheap, but a cross tells a reader nothing they can act on. "This page does not fully work on bookworm" leaves them to find out which of 60 examples. |
| **(c)** Per-version page copies + header selector | Ruled out by §5 on maintenance cost, drift risk and search. |
| **(d)** Per-example annotation, verified | Proportionate to 18 differences. Recommended, §7. |

Option (b) is worth keeping as a *fallback presentation* even if (d) is built: a page-level
summary derived from the per-example data costs nothing once the data exists, and gives the
scanning reader something. The mistake would be to collect data only at page level, since that
cannot be refined later.

## §7. Recommendation, staged

Each stage is worth doing alone. Stop after any of them and the site is in a coherent state.

### Stage 1. Notice when the pin goes stale (do this regardless)

A check that compares the pinned codename against what the archive currently calls `stable`, and
fails when they diverge. Small, and it converts §2's silent staleness into a red build on the day
it starts. **This is worth doing even if every other stage is abandoned.** Forky's release date
sets the deadline, and nothing else here has one.

Also in scope here: make the sandbox Dockerfile version-portable (§3), since nothing else can be
attempted until a second image builds at all.

This check would not have caught anything in §2.4. It compares codenames, and a point release
leaves the codename alone.

### Stage 2. Mask what is cosmetic

Extend `MASK_TOKENS` to cover tool version strings. Removes 15 of 34 differences, makes the
cross-version signal mean something, and pays off on the current target too, since it is the same
mechanism that stops a point release turning a page red.

### Stage 3. Replay against oldstable, and report it

Run the existing replay against the oldstable image, in CI, as a third job alongside `check` and
`replay`. **Advisory, not gating**: it reports which examples do not
reproduce, and a failure there is information rather than a broken build.

That alone answers "does this page also work on bookworm" with evidence, and it produces the data
that any presentation in stage 4 needs. It also costs nearly nothing to try: the experiment in §3
took one image build and two replay passes.

### Stage 4. Say something on the page, per example

Only once stage 3's data exists. The site already has the vocabulary for "this output is true but
not identical for you": `volatile:`, `compare: shape`, and `.skip` with a stated reason. The
natural extension is an example declaring what it needs, and the replay checking it against each
release rather than a human asserting it.

A shape rather than a proposal:

```yaml
- title: "Suppress the total line for multiple files"
  code: wc -l --total=never users.csv wordlist.txt
  since: trixie          # coreutils 9.2; bookworm prints "unrecognized option"
```

and, where the output genuinely differs rather than being absent:

```yaml
- title: "Simulate an install"
  code: apt install -s cowsay-off
  output: |2
    …apt 3.0 output…
  also:
    bookworm: |2
      …apt 2.6 output…
```

Rendering is a separate question and should be decided by the personas in §10 rather than by what
is easiest to build. The default must be invisible: 96% of examples would carry no annotation at
all, and the newbie and the search arrival must not pay for the 4% that do.

## §8. The long term

### §8.1. The differing fraction will probably rise

The stable 14 pages are text processing and file handling: `grep`, `sed`, `awk`, `cut`, `tr`,
`find`, `ls`. Those tools change slowly and the content plan's backlog has plenty more of them,
which pushes the percentage up.

But the pages that differ are the Debian tooling ones, `apt` and `dpkg`, and the content plan
makes those the priority, because they are what the site is named after. **The site is
deliberately investing in exactly the pages that do not survive a release change.** Wave 1 alone
adds `apt-cache` and `apt-file` plus three package-management articles, all of which will sit in
the differing set.

So the 96% should not be read as a stable property. It is high today partly because the site is
still mostly a text-processing reference.

### §8.2. Cost model

Replay time scales as examples × releases, and it parallelises across jobs, one runner each. At
170 pages and 2 releases the numbers stay ordinary. At 4 releases it is a matrix job and still
ordinary. Deleting `replay-shuffled` under ADR-0020 returned a runner, which is the slot stage 3
wants.

ADR-0020 also changed what a second column *means*, which matters more here than the timing. Every
page is replayed in a container of its own, so a difference between the trixie run and the
oldstable run of one page is caused by the release. Under the shared sandbox it could equally have
been caused by another page: an install that fails on the older release changes what everything
after it sees, on that image only. That is the difference between a signal to act on and one to
triage, and it applies to §3's numbers too, which were measured before the change and are worth
re-taking once stage 3 produces them as a by-product.

**Authoring is the limit rather than compute.** Every difference the matrix finds is a human
decision: mask it, annotate it, or accept that the page is wrong for that release. 18 decisions is
an afternoon. The question for five years out is what that number looks like when the
Debian-tooling section is ten times bigger, and the honest answer is that nobody knows yet, which
is an argument for stage 3 (measure it continuously) before stage 4 (build for it).

### §8.3. Five and ten years out

Debian releases roughly every two years, with about five years of support per release counting
LTS. Steady state is therefore **two releases worth supporting at any time**, occasionally three.
It does not grow without bound: two columns in perpetuity rather than N.

That assumes the cutoff policy in §9 holds. Backfilling would make it unbounded.

## §9. Cutoff: how far back

**Recommendation: track what Debian supports, and no further.** In practice stable plus oldstable,
which today is trixie and bookworm.

Reasons: it needs no separate justification, it is self-limiting, and it means the site never
documents a system nobody should be running. Debian's own support window is the right authority
here, and it happens to be the window in which someone can still get security updates.

Against backfilling to bullseye and older: those releases are out of, or nearly out of, even LTS.
Documenting them well would mean testing them, and testing them means keeping images for systems
whose archives eventually move to `archive.debian.org`. The reader who is still on bullseye needs
to upgrade, and the most useful page for them is one that says so.

One exception worth considering later: **the bigger hidden audience is derivatives rather than old
releases.** Ubuntu, Raspberry Pi OS and Proxmox users vastly outnumber Debian users, and most of
this site's apt content is 80% shared with them. That is the same *shape* of problem as the
version axis, and if the per-example mechanism in stage 4 gets built, it should be designed so a
derivative is expressible in it. Not now, but do not design it out.

## §10. Personas

Sketched here because the version question keeps depending on them. **These deserve a proper
document of their own**. This is a first pass rather than a finished set, written specifically to
answer "who is hurt by getting this wrong".

### §10.1. The search arrival

Has a problem and a search result. Is on whatever release their machine runs, usually without
knowing which. Does not know this site exists, will not use a version selector, will not read a
preamble. Almost certainly the largest group by volume.

*Consequence*: version differences must be correct by default and invisible by default. This
persona also rules out serving different content at the same URL (§5).

### §10.2. The seasoned sysadmin

Running oldstable in production, because that is what running production looks like. Wants the
detail beyond what they already know. Fully capable of reading "on bookworm this prints X".

*Consequence*: **this is the persona multi-version work actually serves**, and it is worth
noticing that they are the ones most likely to be on the older release. Any presentation that
treats older releases as a footnote is aimed away from the reader who most needs it.

### §10.3. The newcomer

Learning the basics, on current stable. Every extra annotation is noise competing with the thing
they are trying to learn.

*Consequence*: progressive disclosure rather than inline caveats. Whatever stage 4 renders must be
skippable without losing the sentence.

### §10.4. Ones not in the original list

- **The upgrader.** Moving bookworm to trixie and wanting to know what changes. For them the diff
  *is* the product, and the apt 3.0 output change (§4.3) is exactly what they came for. This
  persona is the best argument for capturing per-example differences rather than discarding them.
- **The derivative user.** On Ubuntu or Raspberry Pi OS, arriving via search on an apt question,
  and mostly well served without knowing this is a Debian site. See §9.
- **The pinner.** Writing a Dockerfile or a CI image and needing to know what a given base image
  actually contains. Cares about exact versions in a way no other persona does.
- **Me.** Stated in the original TODO as a goal of the project: the site exists partly to learn
  from. Worth keeping in the list, because it justifies depth that none of the others would pay
  for.

## §11. Open questions

1. Does the stage 1 staleness check belong in `npm run check`, or as a scheduled CI job? It
   depends on a network fetch, which `check` currently does not do.
2. Is the advisory cross-version job (stage 3) run on every push, or nightly? Nightly costs less
   and the information does not change per commit.
3. If an example is version-specific, is the page's *prose* allowed to differ too? The apt 3.0
   redesign is arguably a prose difference rather than only an output one, and the answer decides
   whether stage 4 is an examples-only mechanism.
4. What happens to a page when the older release's answer is not merely different but *wrong* in a
   way that matters, as with `dpkg -S` and the /usr merge?
5. Do the personas get a document of their own, and does it come before stage 4? §10 suggests it
   should, since stage 4's rendering is the decision they most affect.
6. Which of §2.4's three answers to point-release drift? It has a live cost rather than a deadline,
   and it is the one question here that the current target already pays for.
