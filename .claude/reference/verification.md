# How the verification harness works

*Decisions* about verification (why the replay exists at all, why each page gets a container of
its own, what may and may not be exempted) are recorded in `docs/adr/`. This document is the
mechanism; that one is the reasoning.

Reference, not a checklist. Read this when changing anything under `scripts/`, when a replay
fails for a reason the message doesn't explain, or when a page needs a kind of verification
nothing here already does. For *writing* a page, `.claude/skills/write-content-page/SKILL.md`
is the checklist and it already carries the traps that belong to authoring.

## Testing content examples for real

Every example on a command page is run for real, not written from memory; see
`.claude/skills/write-content-page/SKILL.md` for the full authoring checklist (structure, tiering,
style, verification steps). Command execution for that verification happens inside a disposable
Docker sandbox, not on the host:

```sh
name=$(scripts/sandbox.sh start)
scripts/sandbox.sh exec "$name" "<command to verify>"
scripts/sandbox.sh stop "$name"
```

Verifying an example sometimes means installing a package, using `sudo`, or standing up a real
service: an `ssh` example needs a real `sshd`, and a `crontab` example needs `cron` running. The
sandbox container is thrown away afterward regardless, so none of that persists on the
devcontainer itself.

## Replaying examples to prove the outputs are real

A page's `output:` blocks are the site's core promise, and `npm run check` can't check them: it
validates shape, not truth. `scripts/replay-command-page.ts` replays every example on a page inside
the sandbox and diffs the real result against what the page claims:

```sh
npm run replay              # every page, each in a sandbox of its own (ADR-0020)
npm run replay -- --shard=2/7        # a seventh of them; CI runs seven shards on seven runners
npm run replay -- --record-timings   # full run, and rewrite what balances those shards
npm run replay -- wget curl # just these

# or drive one page directly, which is what the above does per page:
name=$(scripts/sandbox.sh start)
npx tsx scripts/replay-command-page.ts "$name" wc scripts/fixtures/wc.sh   # -> "wc (as root): 25/25 ..."
```

`npm run replay` runs in CI separately from the `check` job (`.github/workflows/ci.yml`), as four
sharded jobs in parallel with it, because "the generator is broken" and "a page is lying" want
different people looking at them. It stays out of `npm run check` so that command needs nothing but
Node: the replay needs Docker, and a check you can't run without a daemon isn't one to fold into
the everyday gate. Serially the whole site replays in roughly four and a half minutes, and the
slowest CI shard in about a minute; a cold run adds building the sandbox image, which the workflow
does as its own step so the log says which half any slowness is in.

`--shard` takes a whole run and hands one part of it back, balanced from the timings in
`scripts/lib/replayShard.ts`'s recorded file, so it composes with `--changed` but not with named
pages, which it refuses rather than replaying some arbitrary subset of them. A single shard is
worth running by hand to reproduce what a red CI shard ran. Starting several at once on one
machine is not: that is the contention `.claude/skills/ship/SKILL.md` §1 records, where
`packages-kept-back` and `release-channels` report as lying because their local apt repository
times out under load. CI does not hit it because each shard has a runner to itself.

That invocation is correct for every page. Some pages have to replay as the unprivileged
`user`, meaning anything printing file ownership (`tar -tvf`, `ls -l`) or documenting a permission
denial, since root simply doesn't get denied. Each of those says so itself, with a
`# verify: --user` line in its setup script that both `replay-command-page.ts` and
`adopt-real-output.ts` read.

A second directive, `# verify: --systemd`, asks for a sandbox booted with systemd as PID 1
(`scripts/sandbox.sh start --systemd`). The `systemctl` and `journalctl` pages need it: the
default sandbox runs `sleep` as PID 1, where every such example prints "System has not been
booted with systemd as init system (PID 1). Can't operate." It is the same image, with systemd
already installed, but a different runtime, costing `--privileged` and the host's cgroup tree,
which is why it is opt-in per page rather than the default. `npm run replay` starts only the
flavours the selected pages ask for, and `replay-command-page.ts` refuses to replay a `--systemd`
page in a sandbox whose PID 1 isn't systemd rather than producing a page of identical errors. Replayed as root, `chmod` scores 9/42 and `tar` 32/42 on pages that
are entirely correct, which reads exactly like a page that has drifted; the mode is part of the
score, so it's printed alongside it.

Each page's sample data lives twice, deliberately: as a `fixtures:` block in `examples.yaml`
(rendered on the page, collapsed) and as `scripts/fixtures/<command>.sh` (recreates those files in
the sandbox). The replay is what keeps the two honest. Fixtures are restored before *every*
example, because some legitimately mutate their input (`sed -i`, `sort -o`).

The replay checks the `fixtures:` blocks themselves too, not just the `output:` blocks: each one
is re-read from the sandbox and diffed, so a block that has drifted from its setup script fails
rather than quietly misleading a reader. By default that read is `cat <name>`. A block that isn't
one file's literal contents sets `from:` to the command that reproduces it: a directory shown as
`ls -lAR projects`, a 40-line file deliberately abridged to `head -3; echo …; tail -1`, control
bytes made visible with `sed "s/\r/␍/"`, or several files shown together with `tail -n +1 a b`.
The rule is that every rendered block is something a reader could actually produce; `from:` is
never rendered, it only keeps the block honest.

Every page with a setup script replays at 100%; how many that is, and how many outputs it
covers, is counted onto the about page at build time rather than written down anywhere. If you
touch a covered page, re-run its replay; if you add examples to an uncovered one, consider adding
a setup script. An uncovered command page is also counted, as the number of pages nothing
re-runs.

An example whose output is real but can't reproduce byte for byte, because it carries a PID, an
uptime or a memory figure, declares `volatile:` with a note saying what differs. The note renders above the
output block ("Your output will differ: …") so a reader can tell an expected difference from a
broken command, and the replay compares that example by *shape* instead: quantities and their
units, weekday and month names, long hex identifiers, digits and column padding are masked on both
sides, so the numbers may move while a renamed field, a vanished line or a changed state still
fails. `volatile:` is for output that varies, not for output a reader could never produce: a
harness artifact has to be removed, not declared. The score names the two kinds separately
(`53/53 documented outputs reproduce (52 exactly, 1 by shape)`), because they are different
claims.

Examples a batch can't replay at all (needing a concurrent writer or a network peer) are listed by
title in `scripts/fixtures/<command>.skip` with a note on how they were verified instead, so
they're excluded explicitly rather than quietly failing. Entries are matched exactly and must name a real
example that documents an `output:` block; one that matches nothing is an error, because it reads
as an exemption while exempting nothing.

`scripts/lib/normalise.ts` decides what a page is allowed to claim, and both tools share it:
adopt writes its `stripArtifacts` output onto the page, verify compares its `normalise` output
against a fresh run. That shared path is why a bug in it is invisible: it corrupts the page and
then certifies the corruption. So it's covered by `test/normalise.test.ts`, and every mask is
anchored to the line shape that produces it rather than applied to the whole output. A documented
output may never contain a mask token (`<TIMESTAMP>`, `<RATE>`, `<VOLATILE>`, `<ELAPSED>`): the
masks are idempotent, so a page carrying one would match any real output forever. The replay
rejects that outright.

The failure modes this has caught are written up in `.claude/skills/write-content-page/SKILL.md`
§4a. The most easily-missed: `wc`/`uniq -c` right-align their columns, and a plain YAML `|` block
silently strips that padding, so such outputs need `output: |2`.

## Prose pages are replayed too, by a different route

Concepts, scripting lessons, recipes and Debian articles state the same kind of claim as a
command page, but as Markdown rather than YAML: a ```` ```bash ```` fence followed by the output
it produced. `scripts/replay-prose-page.ts` replays those, `src/content/proseBlocks.ts` pairs them up,
and `npm run replay` runs both kinds. A prose page opts in by having `scripts/fixtures/<slug>.sh`;
without one it is listed as not replayed rather than passed over silently.

The pairing rule is strict on purpose: an output fence belongs to a command only when it opens on
the line **immediately** after that command's fence closes. Pairing on document order instead
matched a block that prose had separated from its command, which on one page attributed a
simulated install's output to a real one. `test/proseBlocks.test.ts` pins that.

Per-block directives are HTML comments on the line directly above the command fence, since
Markdown has nowhere else to put them and the pipeline drops HTML before a reader sees it:

```
<!-- verify: shape the version moves whenever a security update lands -->
<!-- verify: skip needs a second terminal writing to the file -->
```

A skip must give a reason or the tool refuses to run, since an unexplained exemption reads as
verified when it is the opposite.

**Never document an architecture.** `arm64` on this devcontainer, `amd64` on a CI runner, and
emulation is unavailable locally, so any block containing one fails in exactly one of the two
places. It is the same rule the command pages have always followed by accident; prose pages have
to follow it deliberately. `test/architecture.test.ts` enforces it on every documented output, so
this is a build failure rather than something to remember. It also rejects any exemption whose
stated reason is the architecture: a `.skip` entry or a `verify: skip` note that says "differs
between arm64 and amd64" silences the replay while leaving the page showing one architecture to
readers on the other, which is the defect rather than a record of how it was checked instead.

The constraint is on the **package, not the command**. A package that is `Architecture: all`
prints `all` in both places, so `dpkg -l`, `apt list`, `apt search` and `apt show` are all
documentable as long as every package in the output is arch-independent, which is why the `apt`
page's examples use `cowsay` and `cowsay-off` rather than something more interesting. Check
before choosing one:

```sh
apt-cache show <pkg> | grep ^Architecture:     # "all" is safe, "arm64" is not
```

Where an arch-dependent package is genuinely the right example, narrow the output instead:
`apt-essentials` uses `dpkg -s nano | head -2` and `apt-cache policy curl | head -3` because
`nano` and `curl` are compiled and cannot be shown any other way. A real `apt install` can never
be documented at all, since its output carries download sizes, speeds, the architecture, and dpkg's
carriage-return progress lines.

Bare fences that pair with nothing are output blocks nothing reproduces, and since ADR-0021 each
has to say why with a `verify: skip` note, exactly as a skipped pair does. They count as exempt and
the page states them at its foot, so the reader is told a block exists rather than left to compare
the page's figure against what is in front of them. A config snippet is a different thing and takes
a language tag instead: it was never an output claim, and routing it through the exemption
mechanism would have the page reporting one.

The first page through this, `apt-essentials`, had **four broken output blocks out of four**: two
silently abridged (`dpkg -l` prints a five-line header; one fence ran three commands and showed
only the third's output), and two drifted (`13.5` → `13.6`, `deb13u3` → `deb13u4`). It had been
wrong for months and nothing could have told us.

## The local HTTP server

The `curl` and `wget` pages point at `http://127.0.0.1:8080`, served by
`scripts/fixtures/http-mock.py`: thirteen-odd endpoints that echo a request, return a chosen
status, redirect, delay, set a cookie, demand basic auth, or serve a small linked site with
`Range` and `If-Modified-Since` support. `replay-command-page.ts` installs any `.py` under
`scripts/fixtures/` into `/opt/mock/` in the sandbox, and each page's setup script starts it.

It binds `127.0.0.1` by default, because readers are told to run it on their own machines and it
echoes request headers, `Authorization` included, to anyone who asks. Pass a bind address as a
second argument to widen it deliberately.

The pages name `127.0.0.1` rather than `localhost` on purpose: what `localhost` resolves to is a
property of the reader's machine. wget prints the address it resolved and connected to, so a page
captured where `localhost` means `::1` shows two lines nobody on an IPv4-only host can reproduce,
and a container with IPv6 switched off, which is what a CI runner often is, can't even bind it.
Naming the address makes the same output true everywhere, and drops a resolution line that was
never about wget.

Public request-echo services were the obvious alternative and are the reason the curl page's
outputs were fabricated before this: they answer with a trace id, a live date and the caller's
public IP, so nothing they return can be printed as exact output. Both pages say in their prose
how to start the server, because an example that displays a URL the reader can't reach is
displaying output the shown command didn't produce.

Anything added to the server must stay deterministic: sort JSON keys, keep the fixed indent, and
never return a value from the clock, the client address, or a random source. That extends to the
framework's own headers, so `Date` and `Server` are both pinned, which is what lets a page print a
`curl -i` response verbatim instead of masking half of it. Conditional requests compare the date
they were given rather than assuming it, so `-N`/`-z` can demonstrate both branches, and a range
past the end of a file gets a 416 rather than the whole file over again.
