# ADR-0025: The sandbox has graded privilege, asked for per page

- **Status:** Accepted
- **Recorded:** 2026-08-31
- **Enforced by:** `openSandbox` in `scripts/lib/sandbox.ts`, which checks the sandbox it was
  handed against the flavour the page declared and refuses rather than replaying in a weaker one;
  `readSetupDirectives` in `scripts/lib/replayMetadata.ts`, which rejects a directive nothing
  understands; `test/sandboxFlavour.test.ts`

## Context

Every page is replayed inside a disposable container of its own (ADR-0020), and the default one is
deliberately weak: no host mounts, no docker socket, no capabilities beyond what Docker grants an
ordinary container. That weakness is what makes it safe to let a batch run unattended.

Some pages cannot be written inside it.

**A page about services needs PID 1 to be systemd.** The default sandbox runs `sleep`, and every
`systemctl` example against it prints "System has not been booted with systemd as init system
(PID 1). Can't operate." So does anything that ends a process and then counts what is left, since
`sleep` reaps nothing and every killed process stays in the table as a zombie carrying its own
name.

**A page about filesystems needs to make one.** A container's filesystems belong to whoever is
running it: `overlay` on a 224G disk in this devcontainer and something else on a runner, under a
name no reader has on their own machine. A page reporting free space has nothing honest to report
until it can mount something of its own.

Those are two different needs, and until 2026-08-31 there was one flag for both. `--systemd` was
the only flavour that ran `--privileged`, so the `df` page had to boot an init system it made no
use of in order to mount a `tmpfs`. The grant was also invisible at the point of use: a reader of
`df`'s setup script saw a page asking for systemd and no reason for it.

The alternative to grading it is granting it everywhere, which would put every page on this site
inside a `--privileged` container for the benefit of about five.

## Decision

**Three flavours, in increasing order of what they allow, and a page asks for the weakest one it
can.**

- `default` is an ordinary container. Almost every page.
- `privileged` adds the capabilities to mount a filesystem or attach a loop device.
- `systemd` adds PID 1 and the host's cgroup tree on top of that, because systemd manages cgroups
  and will not start without them.

A page declares what it needs in its own setup script, as `# verify: --privileged` or
`# verify: --systemd`, so the grant is visible in the fixtures of the page that asked for it
rather than applied to everything from a place nobody reads. `SETUP_DIRECTIVE` and
`SANDBOX_FLAVOUR` sit in one file, and the directive a page declares is the flag the runner
passes, so a fourth flavour needs no case statement anywhere.

**The directives resolve to a flavour, not to a boolean each.** Two booleans can express "systemd
but not privileged", which is not a sandbox that exists, and every caller would have to know that
one implies the other. A script declaring both gets systemd, whichever order the lines are in.

**The runner checks what it was handed.** A `--systemd` page is checked against PID 1; a
`--privileged` one against CAP_SYS_ADMIN, read as a single bit out of `CapEff` in
`/proc/self/status` rather than compared against a whole mask, since the rest of the set differs
between kernels and Docker versions and none of the rest is what the page asked for. Without the
check, a page replayed in a sandbox weaker than it asked for reports every figure as missing,
which reads as a page that has drifted rather than as a container started wrong.

**The image matches a real Debian install, and `e2fsprogs` is in it.** A page needing a real
on-disk filesystem makes one on a loop device with `mkfs.ext4` rather than settling for `tmpfs`.

## Consequences

**A page states the privilege it needs, and a reviewer can see it.** ADR-0017 puts a page's setup
script one click from the page, so `# verify: --privileged` is published rather than buried in the
harness.

**Adding a package to the image changes what other pages see, and that is the point.** `e2fsprogs`
ships `e2scrub_all.timer` and `e2scrub_reap.service`, so installing it added a line to three pages'
`systemctl list-unit-files` output. Those pages were wrong before: `e2fsprogs` is Priority
`important`, every Debian install has it, and the sandbox was missing it, so the listings they
documented were ones no reader could reproduce. **A package the sandbox lacks is a page describing
a machine nobody has**, which is the more general form of the rule and the reason to fix the image
rather than the pages.

**This buys almost no wall clock, and that is not what it is for.** Measured 2026-08-31 over
three starts each, a `privileged` sandbox is ready in 110 to 320ms and a `systemd` one in 400 to
670ms, so the boot it skips is worth a few hundred milliseconds on one page. The argument is
least privilege and a page saying what it needs, not speed, and an argument from speed here would
not survive being checked.

**What `systemd` costs beyond capabilities is the host's cgroup tree.** It is mounted read-write
into the container, and a page that only wants to mount a `tmpfs` has no business with it. That is
the difference the split is actually about.

**Nothing stops a page asking for more than it needs.** The directive is a claim by the page's
author, and no gate can tell a page that mounts something from one that asked to and did not. The
check runs in the other direction only, refusing a sandbox that is too weak.

## Revisit when

Revisit when a page wants a capability narrower than `--privileged` grants. `--cap-add` per
flavour is better than a third blanket grant, and the reason it is not here already is that the
two pages needing capabilities need the same one.

Revisit if `privileged` stops being rare. It is opt-in so that the exception stays visible; a
dozen pages declaring it would mean the default sandbox is the wrong shape rather than that the
pages are wrong.

Revisit if a flavour ever needs something the same image cannot provide. All three are one image
and a different runtime today, which is what keeps ADR-0024's published image a single artefact.
A flavour wanting its own image would make that two, and the tag would have to say which.
