# Content plan

What to write on debian.tips, and in what order. Not a spec: `src/content/schema.ts` and
`.claude/skills/write-content-page/SKILL.md` are authoritative on structure, tiering and
verification, and this file is about coverage and sequence.

Rewritten 2026-09-09, replacing a plan built around eight waves and a page-count target. The
inventory in §2 is counted from the tree on that date. The vote counts scattered through the
backlogs are from a 2026-08-18 sample of top-voted questions on unix.stackexchange.com,
askubuntu.com and Stack Overflow's `bash` tag; they have not been re-taken, so they are relative
weights rather than current figures.

Work does not have to follow the order below. §1.1 is a selector for picking something that fits
the session you actually have.

## §1. How this document works

Each backlog is ordered by priority within itself, and every entry carries what §1.2 describes, so
an entry can be picked up cold. When a page ships, delete its entry and add anything it taught to
§13.

### §1.1. Picking work by time and focus

What varies between sessions is how long you have and how much concentration you can give it.
Nothing here needs to be done in order, so use this to find something that fits.

| | **Low focus** | **Deep focus** |
| --- | --- | --- |
| **Under an hour** | A `light` command page against a fixture that already exists (§6 marks them). Cross-link repair after a batch, via `npm run audit:links -- --verbose`. Filling a thin tag. | Reading a replay that failed oddly, against `.claude/reference/verification.md`. |
| **Half a day** | A `standard` command page. A recipe. A comparison whose demonstration already exists on another page's fixture. | A concept page. A comparison needing a fixture of its own. A `flagship` command page. |
| **A day or more** | A batch of three to six pages sharing one fixture (§13 explains why fixture-sharing is how batches are chosen). | A diagnostic hub from §5. Any of the Phase 0 work in §4. |

A batch of pages sharing a fixture costs about what one page costs, which is why §6 groups by
fixture rather than by subject. A diagnostic hub is worth starting only once its spokes exist, so
check the entry's **Needs** line before committing a day to one.

### §1.2. What a backlog entry carries

- **Shape**: for command pages, the tier (`light`, `standard`, `flagship`), which sets length and
  example count. `.claude/skills/write-content-page/SKILL.md` defines them.
- **Needs**: pages that should exist first, and any harness work the page depends on. An entry
  with nothing on this line can be written today.
- **Demo**: what the page demonstrates under replay. An entry that cannot answer this is a
  candidate for prose treatment, and §3.3 says what that requires.

### §1.3. Tag registry policy

`content/tags.yaml` is curated. Before adding a tag: check whether an existing one covers it,
require at least two pages that will plausibly use it, and prefer nouns for subject tags and
adjectives for audience tags. Add it in the batch that needs it.

Two tags are thin. `performance` has no pages and `archives` has one. §6 fills `archives` with a
compression group, and §5 gives `performance` its first pages through the two "why is this slow"
hubs, which is what the tag was always about: `monitoring` answers what is happening, `performance`
answers why it is slow.

### §1.4. Decisions this plan implies, which nothing currently records

Each of these is a proposed ADR rather than a settled one. CLAUDE.md says a change making a
decision nothing covers comes with a proposal for the user to accept, so they are written here and
not in `docs/adr/`.

1. **Scenario-aware verification** (§4.1). A page declares which of several named states an example
   needs, and the page's existing setup script dispatches on the name.
2. **A four-state verification status** (§4.2), replacing a figure that currently cannot
   distinguish a fully verified page from one that verifies nothing.
3. **Naming the release a page was verified against** (§4.3), which changes what every page claims.

## §2. Where the site is now

103 pages, counted 2026-09-09. `src/content/verificationStats.ts` is what the about page renders
from, so its figures are the ones the site publishes about itself.

| Category | Pages | State |
| --- | --- | --- |
| `commands` | 51 | Text processing, the file basics, the process group and the privilege group are all closed. What remains is the diagnostic foundation in §6.1 and the breadth in §6.2 to §6.9. |
| `concepts` | 7 | The three highest-demand concepts are written. §7 holds the rest, and several of them are what a §5 hub will want to link to rather than re-explain. |
| `scripting` | 14 | Complete since 2026-08-29, ending in a capstone that uses the thirteen lessons before it. §11 is the only thing that would extend it. |
| `recipes` | 11 | §9 holds the backlog, led by the ones that tie several written pages together. |
| `debian` | 7 | Bounded to the explainer shape by ADR-0006. Errors go to `troubleshooting`, comparisons to `compare`. |
| `troubleshooting` | 4 | The smallest category and the one §3 argues should become one of the largest. §5 is the plan for it. |
| `compare` | 9 | Nine of twenty candidates. The eleven parked or waiting are unparked by §8. |

Every page replays: there is no page whose documented outputs nothing re-runs.

## §3. The strategy

### §3.1. The editorial question

The site answers "what does this command do" well, and increasingly answers "how does this part of
Unix work". It is weak at "I am stuck, and I need to work out what to do next".

The components are present. A reader facing a service that will not start has `systemctl`,
`journalctl`, `ss`, `ps`, exit codes and file permissions available to them, on seven pages, and
nothing that assembles those into a diagnosis. Four troubleshooting pages against fifty-one command
pages is out of proportion to how people arrive.

So the question this plan is built on is **what situations can a Debian user arrive in where this
site cannot get them unstuck**, rather than what Linux knowledge is missing from the taxonomy. The
second question generates a backlog that never ends and cannot rank itself; the first one ranks by
how stuck the reader is.

### §3.2. Four layers

Category is the page's shape and tags are its subject, which ADR-0006 settles. Underneath that, the
corpus has four jobs:

- **Commands are the tools.** What `lsof` prints and how to narrow it.
- **Diagnostics and recipes are the workflows.** Which tool to use, in what order, and how to read
  what it says.
- **Concepts explain why the tools behave as they do**, so a workflow can link rather than teach
  the same mechanism twice.
- **Debian articles cover where Debian changes the answer**, which is a smaller set than a site
  with this name is tempted to claim.

A diagnostic page is a hub with spokes, so it wants its commands to exist first. That dependency
orders §4 to §10, and this plan imposes no other.

### §3.3. What decides whether a page gets written

Two gates and a tiebreak. A page passes both gates or it does not get written.

**Gate 1, arrival.** Is there a distinct situation a reader arrives in that no existing page
already serves? This catches the duplicate that a topic list cannot: "find what is using a file"
and "find what is using a port" are one `lsof` page with two operands, not two pages.

**Gate 2, substance.** Is there enough to demonstrate to clear the tier floor? A `light` command
page is the smallest thing this site publishes and it still carries 25 to 50 verified examples, so
a page with nothing to show cannot reach the floor. Where a topic is worth covering and resists
demonstration, it may be written as prose, but the page has to say so under §4.2 rather than
drifting into it quietly.

**Tiebreak, for ordering only.** How many other planned pages does this one unblock? §6.1 comes
before §5 on that count, despite §5 carrying the higher reader value.

Verification feasibility is not a gate. Where a valuable topic is hard to verify, the harness is
the thing to change, which is what §4 is for.

### §3.4. What this plan stopped doing

The previous plan ran on a page-count backlog of about 125 and an eight-wave order. Four things
went with it.

- **The count.** Roughly 125 pages was never a target, and treating it as one made "the taxonomy
  has a hole" into a reason to write. §3.3 replaces it with two gates a page has to pass.
- **The waves.** A numbered queue implies work competing for a resource. Nothing here competes, so
  the only ordering is the dependency in §3.2, and §1.1 is how a session picks from what is
  unblocked.
- **The Perl track.** Nine pages, justified by Perl one-liners being cheap to replay. That is a
  property of the harness rather than a reader's need, and cheapness stopped being a reason when
  the cost argument went. Dropped, not deferred.
- **The glossary.** Concept pages, tags and search already occupy that space, and short definition
  pages would be dead ends.

`compare` was nearly dropped with them, on the grounds that most comparisons answer a question
about understanding rather than a choice. §8 keeps the category and says why the test changed.

## §4. Phase 0: work that changes what every later page can do

The one part of this plan that is genuinely a gate. Each item below changes what pages written
after it may claim, so a page written before them may need revisiting.

### §4.1. Scenario-aware verification

**Needs**: nothing. **Blocks**: every hub in §5.

A diagnostic page branches; the replay is linear. One setup script per page runs before every
example, and the restore between examples empties only the page's working directory, so anything an
example does to `/etc`, to a package or to a service persists into every later example on that
page. An eight-branch page currently has to build and tear down eight broken states inside its own
visible examples. `scripts/fixtures/could-not-get-lock-dpkg-frontend.sh` shows the strain: the page
takes a real lock and releases it inside a single fence.

The proposal is that an example declares a scenario name, and the page's existing setup script
dispatches on it. The harness already re-runs setup before every example, so what is new is the
argument and a schema field.

The design is constrained twice over. `scripts/fixtures/df.sh` already writes in the idiom this
formalises, unmounting and remounting from scratch each time because the restore will not undo a
mount, so a scenario is expected to make itself idempotent. And the mechanism stays declarative: a
scenario is a name the fixture script dispatches on, with all the logic in the fixture's own bash
where a reader who arrived from the page can read it. If the harness needs conditionals to express
a page's states, the page is wrong rather than the harness.

Where a state cannot be undone in place, such as a half-configured dpkg, the fallback is a container
per scenario group. Container-per-page isolation already exists under ADR-0020, so that changes the
granularity rather than introducing a mechanism.

The five-second per-example timeout is a number, and a page that starts a service and waits for it
to fail should be able to ask for longer.

### §4.2. A verification status a reader can act on

**Needs**: nothing. **Blocks**: any prose page under §3.3's gate 2.

A prose page with a setup script and no command-output pairs reports 0/0 and passes. It counts in
neither the replayed nor the unreplayed figure, so it looks identical to a fully verified page in
everything the site publishes about itself. No page is in that state, and allowing prose pages
guarantees that some will be.

Four states, replacing the current pass:

- **Verified**: every documented output was replayed.
- **Partially verified**: some outputs were replayed, and some claims on the page sit outside the
  harness. Most pages will land here once the distinction exists.
- **Exempt**: the page documents something the harness cannot re-run, and names how it was checked
  instead.
- **No executable examples**: a prose page with nothing to replay.

This is also the honest form of a badge saying a problem was reproduced. The replay checks that a
documented output still matches what the command printed. It has no notion of a problem, so a page
claiming one would be asserting something its own verification does not check.

### §4.3. Name the release a page was verified against

**Needs**: nothing. **Blocks**: nothing, which is why it is worth doing early.

`scripts/replay/sandbox/Dockerfile` pins `debian:trixie`. Six content files name a Debian release
at all, and most of those are pages about releases, so the rest of the corpus does not say what it
was tested against.

At the next release transition the whole corpus stays green, because the harness keeps testing
against the pin, while the claims drift from what a reader on the new stable sees. The build passes
throughout and nothing surfaces the gap.

Stamping the release on the page converts that into a visible fact. It does not decide the larger
question in `docs/plans/PLAN-DEBIAN-VERSIONS.md`, which is whether the site pins a release, tracks
current stable, or carries version-aware content; it makes deferring that question honest rather
than silent, and it is a prerequisite for the version-aware option rather than a detour from it.

The larger question grows more expensive with every page written before it is answered, and the
content this plan puts first is the apt and dpkg cluster, which is what differs most between
releases.

## §5. Diagnostic hubs

The category the site is thinnest in, and the one §3.1 argues should become one of its largest.
Each page teaches a method of working out which case you are in, rather than documenting a command.

Every page here is `troubleshooting`, and each is a hub: expect six to eight branches, each with an
independently reproducible state under §4.1. Where the reader arrives with a goal rather than an
error, the page belongs in §9 instead.

**Titles are the error string wherever one exists.** A reader pasting `Could not get lock
/var/lib/dpkg/lock-frontend` into a search box is in one specific situation, and the existing page
is the right shape for it. This is the strongest acquisition case the site has: an exact error
message is unambiguous, high-intent, and not well served by sites that write around it.

### §5.1. Services, permissions and disk

- **`service-wont-start`**. **Needs**: §4.1; `systemctl`, `journalctl`, `ss`, `id` (§6.1).
  **Demo**: a unit that does not exist, one that is masked, one whose `ExecStart` binary is
  missing, one that exits non-zero immediately, one refused by permissions on its working
  directory, one whose port is already held, and one that starts and is not listening. The method
  is `systemctl status`, then `journalctl -u`, then the branch. Deliberately broken units are
  cheap to build in a container, so this is the best match on the site between reader value and
  what the harness can show.
- **`permission-denied`**. **Needs**: §4.1; `stat`, `id`, `getent` (§6.1). **Demo**: read, write
  and execute refused in turn; a parent directory without `x` so traversal fails while the file
  itself is readable; wrong owner; right owner and wrong group; the case where `sudo` does not help
  because the operation is not the one being refused; and the case where the mode is correct and
  something else is refusing. Replays as the unprivileged `user`, since root is never refused.
- **`disk-full`**, titled for `No space left on device`. **Needs**: `du`, `df`, `find`, `lsof`
  (§6.1). **Demo**: bytes exhausted; inodes exhausted while `df` reports space free; one directory
  holding most of it; one file holding most of it; a deleted file a process still holds open, which
  is the case that makes `df` and `du` disagree. `scripts/fixtures/df.sh` already mounts tmpfs with
  `size=` and `nr_inodes=` pinned and already exhausts an inode table, so most of this is buildable
  on an idiom that exists.

### §5.2. Package management errors

- **`package-installation-failed`**. **Needs**: §4.1. **Demo**: an unsatisfiable dependency, a held
  package, an interrupted dpkg needing `--configure -a`, a conflict, and what `apt install -f`
  does. Every state is constructible against a fixture repository.
- **`apt-update-failed`**. **Needs**: §4.1. **Demo**: an unsigned repository, a suite that does not
  exist, an unreachable host against the local HTTP mock, a stale list, and the partial failure
  where one source fails and the rest succeed. The last is the branch readers most often get wrong,
  because apt reports it and carries on.
- **`repository-does-not-have-a-release-file`**. **Needs**: nothing beyond §4.1. **Demo**: a
  codename that never existed, and one that has been archived.
- **`dpkg-error-processing-package`**. **Needs**: §4.1. **Demo**: a failing `postinst`, and
  recovery from the half-configured state it leaves.
- **`unmet-dependencies`**. **Needs**: §4.1. **Demo**: what apt is reporting, and why the
  suggested fix is sometimes wrong.

### §5.3. Environment, resources and open files

- **`command-not-found`**. **Needs**: `env` or `printenv` (§6.9). **Demo**: not installed;
  installed and not on `PATH`; present and not executable; found by the shell's hash table after a
  move; shadowed by an alias or a function; and a name that is a builtin. **Keep
  `sudo-command-not-found` standalone and link to it from the not-installed branch.** That page is
  not an instance of this pattern: its subject is Debian's installer leaving `sudo` uninstalled and
  the first user outside the `sudo` group when a root password is set, which is a packaging
  decision rather than a `PATH` story. Folding it in would lose the explanation and give up the
  more specific query.
- **`script-works-in-shell-but-not-cron`**. **Needs**: `crontab` (written), `env` (§6.9).
  **Demo**: `PATH` differing under cron, the working directory differing, `SHELL` differing, output
  going nowhere because nothing is attached, and an exit status nobody is reading. Really a page
  about process environments, and it ties the environment concept page to the scripting course.
- **`why-is-this-process-using-so-much-cpu`** and
  **`why-is-this-process-using-so-much-memory`**. **Needs**: `top`, `free`, `ps` (written).
  **Demo**: a process spinning against one that is blocked; resident against virtual size; cache
  and buffers counted as used, which is the misreading `free` invites. These two give the
  `performance` tag its first pages.
- **`cannot-remove-file-in-use`**. **Needs**: `lsof`, `fuser` (§6.1). **Demo**: unlinking a file a
  process holds open, and why the space does not return until it closes. Note gate 1 against §9's
  port recipe: the operand differs, the method does not, so this earns a page only if the
  explanation differs.

## §6. Command pages

The tools the hubs point at, and the site's slowest-accumulating asset. Grouped by fixture rather
than by subject, because a batch sharing a fixture costs about what one page costs. §13 records the
two batches where that paid.

Not every command gets a page. §3.3 gate 1 is the test, and "Linux has this command and the site
does not" is not an argument.

### §6.1. Diagnostic foundations

Written first, because §5 cannot proceed without them.

- **`lsof`** (`flagship`). **Needs**: nothing. **Demo**: open files by process, by port, by user;
  a deleted file still held; `+D` on a directory. The page `kill-whatever-is-using-a-port` already
  leans on `lsof` with nothing to link to.
- **`fuser`** (`light`). **Needs**: `lsof`. **Demo**: what holds a mount point, and killing by
  file. Shares `lsof`'s fixture.
- **`free`** (`light`). **Needs**: nothing. **Demo**: available against free, and where cache sits.
  Figures are volatile, so the page shows the shape of the answer and names what it is reading.
- **`top`** (`standard`). **Needs**: `free`. **Demo**: batch mode, since interactive output cannot
  be replayed; sorting; what the load average is counting.
- **`mount`** (`standard`). **Needs**: nothing. **Demo**: a tmpfs and a loop device, both under
  `# verify: --privileged`. Shares a fixture with `mkfs` and `blkid` in §6.7.
- **`id`** (`light`). **Needs**: nothing. **Demo**: real against effective, supplementary groups.
  Shares a fixture with `getent` and with `managing-users`, which is written.
- **`getent`** (`light`). **Needs**: `id`. **Demo**: passwd, group and hosts against the local
  database.
- **`dmesg`** (`light`). **Needs**: nothing. **Demo**: what a container can and cannot see, said
  honestly. Candidate for exemption under §4.2, and worth checking before committing to it.

### §6.2. Files and inspection

`COMMAND_GROUPS` in `src/config.ts` reserves `inspect-files` for this group. `stat` is written.

- **`file`** (`standard`). **Demo**: magic-number detection against extensions that lie. Must not
  run against a compiled binary, which prints an architecture.
- **`realpath`** (`light`), with `basename` and `dirname`. **Demo**: symlink resolution, and the
  trims disagreeing on a path with no slash and one with a trailing slash, which §13 records as
  caught under replay.
- **`tree`** (`light`). **Demo**: against `mk_site_tree` in `scripts/fixtures/_common.sh`.
- **`mktemp`** (`light`). **Demo**: templates, directories, and why the predictable name is a bug.
- **`install`** (`light`). **Demo**: mode and ownership in one step, against `cp` followed by
  `chmod`.
- **`dd`** (`standard`). **Demo**: block sizes, `status=progress`, and a loop-device image. Shares
  §6.7's fixture.

### §6.3. Text processing, completing the group

The cheapest pages on the site: self-contained transformations of fixture text, no system state, no
clock, no network.

- **`comm`** (`light`), **`paste`** (`light`), **`join`** (`standard`) share one fixture of sorted
  files. `join` is the hard one: both inputs have to be sorted the same way first.
- **`seq`** (`light`), **`split`** (`light`) with `csplit`, **`column`** (`light`),
  **`strings`** (`light`), **`nl`** (`light`) share a second fixture.
- **`printf`** (`standard`). **Demo**: format specifiers, and the reason it survives where `echo`
  varies between shells. Absorbs the `printf` vs `echo` comparison from §8.

### §6.4. Processes and scheduling

- **`pgrep` and `pkill`** (`standard`). **Demo**: matching by name, by user, by full command line.
  **The harness wraps every example in `bash -c`, so an unnarrowed `-f` pattern matches the
  harness itself.** §13 records this.
- **`nice` and `renice`** (`light`). **Demo**: priority changing what the scheduler does with two
  competing processes.
- **`timeout`** (`light`). **Demo**: exit status 124, and the signal it sends.
- **`watch`** (`light`). **Demo**: intervals and `-d`. Output is inherently repetitive, so the page
  shows one capture and says so.
- **`uptime`** (`light`). **Demo**: load average against processor count, which is the misreading
  it invites. Figures are volatile.

Any page here that ends a process and then counts what is left needs `# verify: --systemd`, for
the reason §13 gives.

### §6.5. Users and privilege

- **`passwd`** (`standard`). **Demo**: expiry, locking, and what a locked account can still do.
- **`chage`** (`light`). **Demo**: the fields, and how they interact with `passwd -l`.
- **`update-alternatives`** (`standard`). **Demo**: the editor and the `sh` alternatives, and
  Debian's reason for the mechanism.
- **`dpkg-reconfigure`** (`light`). **Demo**: against a package whose debconf answers change
  something visible.

Rebuild every account and group on each restore with ids pinned. §13 explains what goes wrong
otherwise.

### §6.6. Archives and compression

Fills the `archives` tag, which currently has one page.

- **`gzip`** (`standard`), with `gunzip` and `zcat`. **Demo**: compressing in place, keeping the
  original, and reading without decompressing.
- **`zip` and `unzip`** (`standard`). **Demo**: the format Debian does not install by default,
  which is worth saying on the page.
- **`xz`** (`light`), with `zstd`. **Demo**: the tradeoff against `gzip`, measured on one fixture
  rather than asserted.

All three share a fixture with `tar`, which is written.

### §6.7. Disk and storage

Unblocked. `# verify: --privileged` exists as a fixture directive, `scripts/fixtures/README.md`
documents it, and `scripts/fixtures/df.sh` uses it. Loop devices work under it, which is what the
previous plan was waiting for.

- **`mkfs`** (`standard`), **`blkid`** (`light`), **`fsck`** (`standard`) share a loop-device
  fixture with `mount` (§6.1) and `dd` (§6.2). **Demo**: making a filesystem in a file, mounting
  it, breaking it and repairing it.
- **`ncdu`** (`light`). **Demo**: batch export, since the interface cannot be replayed.

Still out of reach, and not on any list here: `lsblk`, `lspci`, `lsusb`, `fdisk -l`, `smartctl`,
`sensors`, `ethtool`. The container has no hardware, so each prints nothing or a synthetic view.

### §6.8. Networking

Most of this group waits on a fixture. What is written is `curl`, `wget`, `ssh` and `ss`, and
`scripts/fixtures/http-mock.py` is the pattern the rest would follow.

- **`rsync`** (`flagship`). **Needs**: nothing. **Demo**: local trees, the trailing-slash rule,
  `--dry-run`, `-H` for hard links, which §13 records as `rsync`'s alone. Written against local
  paths, so no peer is needed.
- **`nc`** (`standard`). **Needs**: nothing. **Demo**: a listener and a client inside one
  container. Execute the listener directly rather than through `env`, or `ss -p` names it after
  the interpreter.
- **`dig`** (`flagship`) and **`host`** (`light`). **Needs**: a local resolver fixture serving a
  fixed zone on `127.0.0.1:5353`. That is the same class of work as the HTTP mock and it unblocks
  the whole DNS group.
- **`ip`** (`standard`). **Needs**: a decision about what a container's synthetic interfaces may
  honestly show. Worth attempting only after the resolver fixture.

`ping`, `traceroute` and `mtr` need a peer, and `ifconfig` will not get a page for the same reason
`netstat` does not.

### §6.9. Shell and environment

- **`env` and `printenv`** (`standard`). **Needs**: nothing. **Demo**: running a command with a
  modified environment, and the difference between a shell variable and an exported one. Blocks
  two hubs in §5.3.
- **`alias`** (`light`). **Demo**: why an alias is invisible to a script.
- **`history`** (`light`). **Demo**: expansion, and where the file is written.
- **`apt-mark`** (`light`). **Demo**: hold, unhold, and manual against automatic. Feeds §5.2 and
  §10.
- **`debsums`** (`light`). **Demo**: a modified conffile detected.

Do not print `pwd` from the replay's working directory, do not print `$HOME`, and do not print an
architecture. §12 has the full set.

## §7. Concepts

Rated above command pages by the original demand sample, and several entries here are what a §5 hub
would otherwise have to teach twice.

- **P1 Links, inodes and what a filename is**. **Needs**: nothing. **Demo**: why `rm` on a running
  program's binary is fine, why `mv` across filesystems copies, and why a hard link survives its
  original name. `compare/hard-vs-symbolic-links` is written and covers the choice; this covers
  the mechanism.
- **P1 Globbing is not a regular expression**. **Demo**: `*` and `?` in the shell against the same
  characters in `grep`, brace expansion, word splitting, and where the shell stops and the command
  starts.
- **P2 Regular expressions: BRE, ERE and PCRE**. **Demo**: the same pattern under `grep`, `grep -E`
  and `sed`. The `regex` tag has no page that owns it.
- **P2 Users, groups, `/etc/passwd` and `/etc/shadow`**. Supports §5's permission hub and §6.5.
- **P2 Locales and character encodings**. **Demo**: `LC_ALL=C` changing what `sort` answers, which
  is the case people meet without knowing why.
- **P2 Standard streams and buffering**. **Demo**: `grep` on a live stream showing nothing until
  `--line-buffered`. Small, and it explains a class of confusion nothing else covers.
- **P3 File timestamps: atime, mtime, ctime**, and why there is no creation time. `stat` is
  written and links here.
- **P3 How Linux boots**: firmware, GRUB, initramfs, systemd, login. Orientation, and a candidate
  for prose treatment under §4.2.

## §8. Comparisons

Nine written of twenty identified, with eleven parked or waiting on a page that did not exist.
**Unpark them.**

The previous test was whether a command page already contained the material, and by that test seven
were redundant. ADR-0006 files a page by how its reader arrives, and a reader searching "X vs Y"
arrives with two options and no page whose title, URL or opening paragraph is about choosing
between them. With search as the only acquisition channel and no query data to arbitrate, serving
that reader is worth more than avoiding overlap.

The site has already answered this once in the other direction. `which` was written as a command
page, spent eighteen of its twenty-four examples on other commands, and was split so
`compare/which-vs-type-vs-command` could own the choice. Both pages improved.

**How ownership works.** The comparison owns the decision and is the only page that stages it. The
command page owns its own command and links out at the sentence that raises the choice. Where a
command page has absorbed a comparison, thin that page and link rather than skipping the
comparison. Count the cost honestly: seven written pages need thinning, and
`commands/managing-users` is built on a contrast it would be handing away.

**No quota.** Twenty was never a target. Write the ones with a plausible query behind them.

Unparked, each needing a section thinned on the page that currently holds it: `terminal` vs `shell`
vs `tty` vs `console`; `nohup` vs `disown` vs `&` vs `tmux`; `[` vs `[[` vs `((` vs `test`; `>` vs
`>>` vs `tee`; `grep` vs `egrep` vs `grep -E`; login vs non-login vs interactive shells; `useradd`
vs `adduser`.

Waiting on a page: `/opt` vs `/usr/local` vs `/usr/bin` wants nothing further, since
`concepts/filesystem-hierarchy` is written; `rsync` vs `scp` vs `sftp` wants §6.8's `rsync`; `ip`
vs `ifconfig` wants §6.8's `ip`. `printf` vs `echo` is absorbed by §6.3's `printf` page instead.

Every page here carries a demonstration of the difference. Without one a comparison is an opinion
piece.

## §9. Recipes

The reader arrives with a goal. Where they arrive with an error, the page belongs in §5.

- **P1 Free up disk space when the root filesystem is full** (+838). **Needs**: §5.1's `disk-full`.
  Ties `du`, `df`, `journalctl` and apt cleanup together. The goal-shaped counterpart to the hub.
- **P1 Work out why an ssh key is not accepted** (+746). **Demo**: permissions on `~/.ssh` and
  `authorized_keys`, reading `ssh -v`, and the server-side setting. Needs an sshd in the container,
  which the `ssh` page's fixture may already stand up.
- **P2 Compare two directory trees** (+682). **Needs**: §6.8's `rsync`. **Demo**: `diff -rq`,
  `rsync -n`, and checksums disagreeing about what "same" means.
- **P2 Parse JSON on the command line** (+681). `jq` is written; this is the task-shaped entry.
- **P2 Generate a random password** (+674). **Demo**: `/dev/urandom`, `openssl rand`, and which are
  safe.
- **P2 Run something every N seconds or at a specific time** (+658). **Needs**: §6.4's `watch`.
- **P2 Serve a directory over HTTP for two minutes**. **Demo**: `python3 -m http.server` against
  the local mock, with the security caveat.
- **P2 Automate a rotating backup**. Ties `tar`, `find -mtime` and `crontab` into one workflow.
- **P2 Rotate and manage log files**. `logrotate`, and how Debian packages ship their configs.
- **P3 Extract any archive whatever the format**. **Needs**: §6.6. The dispatch table.
- **P3 Unfreeze a terminal after Ctrl-S** (+974). Tiny, and it belongs to the terminal concept
  page.
- **P3 Count lines of code in a project** (+1414). `cloc` is the honest answer.
- **P3 Securely delete a file**. **Demo**: `shred`, with the SSD and copy-on-write caveat, which is
  the part most advice omits.

## §10. Debian articles

Bounded by ADR-0006 to the explainer shape on a subject that would be wrong on a non-Debian system.
Everything else with a Debian subject files under its own shape and takes the `debian` tag.

The test is whether Debian changes the answer, not whether the site is called debian.tips.

- **P1 Which Debian am I running, and what the codenames mean** (+126). **Demo**:
  `/etc/os-release`, `/etc/debian_version`, `lsb_release`. Pairs with §4.3, since the release stamp
  gives every page a reason to link here.
- **P1 The deb822 sources format**. **Demo**: a `.sources` file against the one-line format it
  replaces, field by field. Debian 12 onwards ships it and most tutorials predate it.
- **P2 Holding a package back, and pinning**. **Needs**: §6.9's `apt-mark`. **Demo**:
  `/etc/apt/preferences.d` against a fixture repository.
- **P2 Upgrading a single package without upgrading everything** (+1125), and the honest answer
  about when that is not possible.
- **P2 Cleaning up: old kernels, the apt cache, orphaned config** (+772). The one where bad advice
  makes systems unbootable, so the page is worth getting exactly right.
- **P2 Upgrading between Debian releases**. **Needs**: a decision under §4.3, since the page's
  subject is the transition the harness cannot cross.
- **P2 Automatic security updates with `unattended-upgrades`**, including its part in the lock
  contention that `could-not-get-lock-dpkg-frontend` documents.
- **P2 Debian's file layout conventions**: `/etc/default`, `/etc/systemd/system` against
  `/usr/lib/systemd/system` (+133), conffiles, and what `ucf` does.
- **P2 Firmware and the non-free-firmware component** (+115). Debian 12 changed this, and it is the
  wifi-does-not-work experience.
- **P3 Debian's release process and the freeze**. How testing becomes stable, and why that decides
  which suite to run.

## §11. Journeys

The scripting course proves that ordered content works here, and it is the only sequence the site
has. `order:` is carried by `scripting` alone, and the homepage's hand-picked "Start here" list in
`src/config.ts` is the only other curated path.

A journey is a curated ordered path across categories: "something is broken" runs from reading the
error through finding the process, checking permissions, reading logs and checking service state;
"administering a Debian server" runs from `sudo` through users, permissions, packages, services,
logs and scheduled tasks.

It can be built either of two ways. Extending the curated-link mechanism to several named lists is a
configuration change. A general ordered-sequence type, with prev and next links across categories,
is an ADR and a schema change.

**Build the second.** The reader gets an answer to "what should I read next" that a link list does
not give, and it generalises the mechanism `scripting` currently owns alone. Do it after §5 and
§6,
since a journey across pages that do not exist is not worth designing.

## §12. What the harness cannot verify

Knowing this before a batch starts is worth more than finding it halfway through.

**Architecture may never appear in output.** `arm64` here, `amd64` on a CI runner, no emulation
locally, so any block naming one fails in exactly one place. `test/architecture.test.ts` enforces
it. Impossible: `uname -m`, `arch`, `dpkg --print-architecture`, `lscpu`, `file` on a compiled
binary. Blocked: `dpkg-query -W -f='${binary:Package}'`, `dpkg --get-selections`, apt's history log
install lines, unfiltered `dpkg -l` and `apt list --installed`. Safe: anything against a package
whose architecture really is `all`, and `apt-cache policy` against a fixture repository declaring
`Architectures=all`.

The rule covers numbers as well as names. A `/proc` bitmap can differ between the two machines
because of a bit neither page is documenting, which §13 records.

**No hardware.** No physical disks, network cards, PCI devices or sensors. Loop devices work under
`# verify: --privileged`, which is what unblocks §6.7.

**No DNS or outbound network.** `scripts/fixtures/http-mock.py` is the established pattern, and the
DNS equivalent is what §6.8 waits on.

**No terminal by default.** `script -qec '<command>' /dev/null` gives one block a pseudo-terminal.
The pty is always `/dev/pts/0` and `stty size` reads `0 0`, so nothing depending on terminal width
can be shown.

**One pinned release**, which §4.3 addresses.

**What verifies especially well**, and should influence what a low-focus session picks up: text
processing, shell mechanics, comparison demonstrations, and anything that is a self-contained
transformation of fixture text. No system state, no clock, no network, no ownership.

## §13. What earlier batches taught

Distilled from the shipped ledger this plan replaces. Each of these cost a batch something once.

### §13.1. Choosing a batch

- **Choose by fixture, not by subject.** Five command pages and a comparison shipped in one batch
  for about what one page's fixture usually costs, because four of the six replayed against the
  `mk_site_tree` in `scripts/fixtures/_common.sh`. It has paid twice.
- **The link graph is a demand signal that vote counts cannot see.** `cat` was named in prose on
  thirty-one pages with nothing to link to, and `sudo` on twelve. Run
  `npm run audit:links -- --verbose` when choosing, not after shipping.
- **Two pages that each complete the other go together.** `arrays` and `parameter-expansion`
  shipped as a pair because a trim applied to `"${arr[@]}"` runs on every element.
- **A page written for its own sake is fine.** `cowsay` was on no backlog.

### §13.2. What the replay does to a page

- **A background process inherits the example's stdout and holds the pipe open.** `sleep 300 &`
  with no redirect stops the replay for five minutes while reporting success throughout. A pipeline
  needs the redirect on its first stage too.
- **`pkill -f` matches the harness.** Every example is wrapped in `bash -c <code>`, so that command
  line contains the pattern.
- **Killing a process and then counting needs `# verify: --systemd`.** The default sandbox's PID 1
  is the `sleep` holding the container open, so it reaps nothing and every killed process stays as a
  zombie carrying its own name.
- **A fixture that starts processes should test for the sockets or files they provide**, not for
  the processes, so an example that closes one is repaired on the next restore. Guarded that way
  `ss` costs 13ms per restore against 342ms cold.
- **A listener must be executed directly rather than through `env`**, because a process is named
  after the file the kernel was told to run.
- **An example whose claim is that something is absent has to create it first.** One recipe
  replayed green while proving nothing, because the restore had already removed what it was looking
  for.
- **Account and group state survives the restore.** Rebuild every account on each restore with ids
  pinned, include names that only an example creates, and note that `usermod -l` leaves the group
  under the old name.

### §13.3. What a page may not print

- **The replay's working directory**, which is named after the page. No example prints `pwd` from
  it. A fixture that needs a stable path builds one under `/srv`.
- **`$HOME`**, for the same reason.
- **An architecture**, including a number that encodes one.
- **A timestamp near the six-month boundary**, where `ls -l` switches from a time of day to a year.
  ADR-0027 and `test/timestampDrift.test.ts` hold fixture dates clear of it.
- **`df` with no arguments**, which reports the host's overlay filesystem. Mount tmpfs with `size=`
  and `nr_inodes=` pinned and measure that instead.
- **A shell's `Terminated` notice**, which does not appear under replay, and an asynchronous job
  notice, which bash prefixes with `bash: line N:` when it is not interactive.

### §13.4. Choosing the wrong verification tool

- **`compare: shape` masks digit runs**, reducing `0.0.0.0:8080` and `127.0.0.1:5432` to the same
  token. Using it to fix an ordering problem trades a real check for one that cannot fail.
  `unordered:` (ADR-0026) is what an ordering problem wants.
- **A page that publishes a script should `cat` it**, so the listing a reader reads is a checked
  block rather than a copy that can drift.

### §13.5. Writing the page

- **Build a page around a mistake rather than a flag list.** `mkdir -p -m 700 outer/inner` leaves
  `outer` at the umask default; `touch -d` moves the modification time back while the change time
  jumps to now; `ln -sf` on an existing symlink to a directory creates the new link inside it.
- **A command page whose examples keep pulling in other commands is a comparison page.** `which`
  was split after it was written, and noticing before the replay is cheaper than after.
- **A comparison page invites a plausible false second half**, because its sentences are built on
  symmetry. Two were caught against the sandbox: `tar` preserves hard links unasked, and `vim`
  detects a hard link rather than severing it.
- **Verify both halves of a claim about defaults.** A stopped process does not hold a pending
  `TERM` in general, because a default action needs nothing from the process.

### §13.6. The site outgrowing its defaults

`test/pageChecks.test.ts` crossed the default five-second timeout at 98 pages, and the replay shard
count in `.github/workflows/ci.yml` has been re-measured once. Both are the corpus growing rather
than a page misbehaving, and `npm run shards` is what reports the second. Expect more of these, and
treat one as a measurement to re-take rather than a failure to work around.
