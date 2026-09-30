# ADR-0029: A figure about the host is never a checked output

- **Status:** Proposed
- **Recorded:** 2026-09-30
- **Enforced by:** nothing yet. The decision names two checks, a test that refuses a host figure in a
  compared output and a build error for a replayed page with nothing to replay, and neither exists
  until this record is accepted.

## Context

The replay compares what a command prints in a container against what the page says it printed.
That works for anything the page's setup script builds, but it fails for a figure the container
cannot own: a total that belongs to the machine the container happens to be running on.

Memory is the clearest case, measured in the sandbox image on 2026-09-30:

- `free -m` reported a total of 3916 MB, which is the devcontainer host's memory.
- Started with `docker run -m 256m`, it reported 3916 MB again. The limit appeared only in
  `/sys/fs/cgroup/memory.max`, as 268435456. `free` reads `/proc/meminfo`, which the container
  shares with the host, so constraining the container does not change what `free` prints.
- The used, free, cache and available figures moved between consecutive runs.

So any `free` output a page captures is true of one machine for one moment. That is the defect
ADR-0004 rules out for architecture names, in numbers rather than in a word, and
`test/architecture.test.ts` does not look for it.

The same class blocks more than memory. `uptime` prints the host's load average, the header of
`top` prints the host's uptime, load and totals, `dmesg` prints the host kernel's ring buffer where
a container can read it at all, and `ip` prints interfaces the container runtime invented.
`docs/plans/PLAN-CONTENT.md` holds `free`, `top`, and the two hubs on why a process is using so
much CPU or memory, until this is settled, and marks `uptime`, `dmesg` and `ip` as needing it.

A figure about a process the page starts itself is a different case. A Python process holding a
100 MB `bytearray` reported an RSS of 110136 KB in one container and 110144 KB in the next, with
the same VSZ both times. A process spinning in a loop showed state `R`, and one in `sleep` showed
`S`, in both of two runs. Those figures belong to something the fixture built, just as a file's
size does.

Four responses were considered for the host figures.

**Compare by shape.** ADR-0005's shape comparison masks every digit run, so a `free` block would
match any machine's `free` block. The footer would still say the output is checked, but the check
would cover only the column headers. That is worse than an honest exemption, because it counts the
block towards the figure `/about/` publishes.

**Constrain the container.** A memory limit alone does not work, because the cgroup limit does not
reach `/proc/meminfo`. LXCFS can present a container-scoped `/proc/meminfo`, but it is a FUSE
filesystem running on the host, so both the devcontainer and every runner would need it installed
before the replay could start. Even then it would fix only the total. The used, free, cache and
available figures would still move from run to run, because they report whatever the page cache
and the running processes hold at that moment, so every other figure on the line would still need
the shape comparison rejected above.

**Leave the pages unwritten.** Those pages answer real questions, such as why `free` reports so
little free memory on a healthy machine. `PLAN-CONTENT.md` §3.3 says a topic that is hard to verify
is a reason to change the harness rather than a reason to skip the topic.

**Exempt the block, and check what the page teaches from it another way.** The page shows the
command the reader will type, with output captured from a real run and a written reason why it is
not compared. Where the page teaches something about that output, a second example has the command
work the claim out itself and print the result. The misreading a `free` page exists to correct is
that cache is counted as used, and procps-ng 4.0.4 defines `used` as `total` minus `available`, so
`free -b | awk '/^Mem:/ {print ($2 - $7 == $3) ? "used is total minus available" : "used is not total minus available"}'`
prints the first answer on any machine running that `free`. It did in four containers, one of them
under a 256 MB limit. Chosen: the reader keeps the ordinary command, and the replay checks the claim
the page makes about it.

`PLAN-CONTENT.md` §4.2 separately asked for a status a reader can act on. Most of it has since been
built. Every page footer already says how many outputs it checks, how many of those by shape or in
any order, and how many are exempt with the reasons in the source. A page whose outputs are all
exempt says that in its own sentence. Two states still say the wrong thing, and both concern a page
with no output to check:

- **A setup script and nothing to check.** `checksSentence` in
  `src/templates/partials/sourceLinks.ts` renders nothing for a page with a script and zero checked
  and zero exempt blocks, so the footer offers a replay command and then makes no claim about what it
  checks. No page is in this state on 2026-09-30.
- **No setup script and nothing to check.** The footer says the page's examples "were checked by
  hand when it was written and have not been checked since". A prose page with no command output has
  no examples for that to describe, and `PLAN-CONTENT.md` §3.3 allows such pages to be written.

## Decision

**A figure that describes the host is never part of a compared output.** A host figure is one the
setup script cannot determine: memory, swap and load totals, uptime, the host kernel's messages, and
anything the container runtime supplies in place of hardware, such as its synthetic network
interfaces. Architecture is already covered by ADR-0004, and this extends the same rule to numbers
and devices.

**A block showing host figures is exempt, and its reason names which figures belong to the host.**
It uses the existing mechanisms: `scripts/fixtures/<slug>.skip` on a command page and
`<!-- verify: skip <reason> -->` on a prose page. It is captured from a real run like any other
output. "Hard to reproduce" is not a reason under this record. The reason has to identify a figure
from the list above.

**Where a page teaches something about host figures, that claim is a checked example of its own.**
The command works the claim out and prints it: a comparison, a ratio, a yes or a no. The claim has
to hold on every machine the replay could run on, and it is the page author's job to establish that,
because the replay can only show it held on the machines it happened to run on. The safe kind is a
property of the tool, such as how `free` defines a column. A property of the machine that is only
usually true, like there being more available memory than free, is stated in prose with its
condition.

**A figure about a process or object the fixture built is an ordinary output**, compared exactly
where it reproduces and by shape where it moves. Process memory is expected to differ between
architectures, because the same program is a different binary on each. So a page states it as a
difference between before and after, or rounds it to the unit the claim is about, and never shows a
bare RSS. The measurements above were both taken on arm64, so the first page to rely on this finds
out on its first CI run whether the form it chose holds on amd64.

**A page with no output to check says so.** Its footer states that the page shows no command output,
whether or not it has a setup script. A page that has a setup script and nothing for it to check,
neither checked nor exempt, fails the build. Such a script is either left over from output the page
no longer shows, or a sign that the page's output fences have stopped pairing with their commands,
and in both cases the footer would offer a replay command that checks nothing. A page with no output
also leaves `unreplayedProsePages`, which counts pages missing a script they need.

## Consequences

**The exempt count on `/about/` will rise**, and every page with a host block says so in its own
footer. Every exemption stays visible, but the site's headline figure covers a smaller share of what it shows.
The limit on that is the list of host figures: a block may be exempted under this record only by
naming one.

**`free`, `top`, the CPU and memory hubs, `uptime` and `dmesg` become writable.** `ip` needs the
resolver fixture as well. The `performance` tag gets its first pages from the hubs.

**Two checks follow if this is accepted.** A test in the style of `test/architecture.test.ts` looks
for host-figure signatures, such as `free`'s `Mem:` and `Swap:` rows or a `load average:` line, in
compared outputs, and fails on them. The build error for a replayed page with nothing to check goes
in `src/content/pageChecks.ts`, with the footer sentence in `sourceLinks.ts`. A signature list is
pattern matching and misses forms it does not know, the limitation ADR-0027 accepts for dates. So the
test also runs each signature against a real captured output of its command and requires a match,
which stops a broken pattern from passing every page without matching anything.

**The derived-claim examples read less like what a reader types.** They sit beside the ordinary
command, and their description says what they establish. A page whose every example is a derivation
has lost the ordinary command, and that page should be a concept page instead.

**`PLAN-CONTENT.md` §4.2 closes**, and §1.4, §5.3 and §6.1 point here.

## Revisit when

- GitHub-hosted runners start giving containers a scoped `/proc/meminfo`, or the replay moves to
  hosts this repository controls. Host figures could then be fixed values, and this becomes a rule
  about the ones still left over.
- A derived claim fails on a runner. That means a claim thought to hold on every machine did not,
  and the next page's derived claims need a stricter test before they are written.
- Host blocks come to outnumber the checked outputs on a page. That page is documenting the host
  rather than the tool, and the §3.3 gates should be applied to it again.
