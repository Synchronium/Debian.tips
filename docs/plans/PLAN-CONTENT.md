# Content plan

Working roadmap for what to write on debian.tips, and why. Not a spec: `src/content/schema.ts`
and `.claude/skills/write-content-page/SKILL.md` are authoritative on structure, tiering and
verification; this file is about *what* to cover and in *what order*.

The inventory in §2 is counted from the tree, most recently on 2026-09-05. The vote counts
throughout §3 to §9 are the 2026-08-18 sample and have not been re-taken, so treat them as
relative weights rather than current figures.

A page that ships moves to §13 with what writing it taught, and leaves a dated one-line marker
behind in its backlog. The backlogs are for what is *not* written yet.

## §1. How this document works

Each backlog is roughly ordered by priority within itself. When a page ships, move it to §13 so
this file stays a live map rather than a wishlist. Batches are suggested groupings for parallel
`write-content-page` runs, not a rigid execution order.

### §1.1. Tag registry policy

`content/tags.yaml` is curated, not freeform. Before adding a tag: check whether an existing one
covers it; require at least two pages that will plausibly use it; prefer nouns for subject tags
and adjectives for audience tags. Add it in the batch that needs it, not speculatively.

Current usage is lopsided and worth watching. Recounted 2026-09-05 from page frontmatter:
`performance` still has **zero** pages and `archives` has one. `cron` has two; `disk`, `regex` and
`ssh` have three. A tag with one page is a dead end for a reader who clicks it. Either the backlog
below fills them or they should be retired.

The fix for a thin tag is usually one page everything else already wanted to link: `terminal` sat
on that list until the concept page and `less` took it to nine, and `disk` left it when `df`
shipped. That leaves two. `archives` waits on §4.10, which is two pages nobody has argued against.
`performance` has no page in prospect anywhere in this document, so it is the one genuinely facing
retirement rather than filling, and the honest question about it is whether `top` and `lsof` would
carry it or whether the subject is really `monitoring`.

### §1.2. Verification is part of the page, not polish afterwards

Every new page ends at N/N on `npm run replay -- <slug>`. Command pages declare `fixtures:` and
mirror them in `scripts/fixtures/<slug>.sh`; prose pages opt in by having that setup script at
all. Budget for it the way you budget for writing the examples, because it is the only check that
the outputs are true. `npm run check` validates shape rather than truth.

§11 belongs to this policy: it lists the content that **cannot** be verified here, so a batch
doesn't discover it halfway through.

## §2. Where the site is now

Counted 2026-09-05 by `verificationStats` in `src/content/verificationStats.ts`, which is the
same routine the about page renders from, so these figures are the ones the site itself publishes
rather than a second tally that can drift from them.

**93 pages. 1,921 documented outputs re-run on every push**, across 48 command pages and 44 of
the written articles, with 33 more documented and exempted, each naming how it was verified
instead. 1,897 examples across the command pages, 128 blocks of sample data, and 119 outputs
declared `volatile:`.

Eight pages in five days, against twenty-five in the five before them. The drop is not a stall:
those days went into two decisions the pages had been getting wrong silently, `unordered:`
(ADR-0026) and the fixture-date band (ADR-0027), and into a review of the whole repository. Both
ADRs came out of a page that passed, which is the kind of finding that only arrives between
batches.

**Every page replays.** `unreplayedCommandPages` and `unreplayedProsePages` are both zero: there
is no page left whose outputs nothing re-runs. That closes the largest item in §11.5.

| Category | Pages | State |
|---|---|---|
| `commands` | apt, apt-cache, apt-file, awk, cat, cd, chmod, chown, cowsay, cp, crontab, curl, cut, df, diff, dpkg, du, find, grep, head, job-control, journalctl, jq, kill, less, ln, ls, man, mkdir, mv, ps, rm, sed, sort, ss, ssh, sudo, systemctl, tail, tar, tee, touch, tr, uniq, wc, wget, which, xargs | 48 pages. Text processing and the file basics are both complete enough to stop being the priority, and **the file group closed its P1 and P2 lines on 2026-09-05** bar the combined file-inspection entry. Debian package tooling is done to the §4.1 P1 line, the process group to its own as of 2026-08-30. Every §4 P1 is now written: `ss` and `man` were the last two. What is left is **no user-management page beyond `chown`**, a disk group of three, and a networking group whose remaining pages all wait on §11.3. |
| `concepts` | environment-variables-and-path, exit-codes-and-error-handling, file-permissions-explained, pipes-and-redirection, processes-and-signals, terminal-shell-and-tty | 6 pages. §3.1 rates this layer above any command page, and the three highest-demand ones are written, so the next concept is a §5 P2 rather than a P1. |
| `scripting` | your-first-script, variables-and-quoting, conditionals-and-test, loops, script-arguments, functions, arrays, parameter-expansion, where-a-script-lives, arithmetic, here-docs, traps-and-cleanup, debugging-and-robustness, a-real-script | **Complete, 2026-08-29.** 14 lessons ending in a capstone that uses all thirteen before it. The two candidate additions in §7 are the only open items, and neither is a gap a reader would notice. |
| `recipes` | add-a-directory-to-path, bulk-rename-files, copy-files-between-machines, find-and-replace-across-files, find-permission-denied, find-the-largest-files, keep-a-program-running-after-logout, kill-whatever-is-using-a-port, monitor-a-log-in-real-time | 9 pages. **All four P1 recipes shipped 2026-08-29**, after six weeks in which the category gained nothing. What is left is the §9 P2 list. |
| `debian` | apt-essentials, install-a-deb-file, list-installed-packages, release-channels, systemd-services, third-party-repositories, which-package-provides-a-file | 7 pages, bounded by §10.0.1 to the explainer shape. Errors go to `troubleshooting` instead. |
| `troubleshooting` | could-not-get-lock-dpkg-frontend, packages-kept-back, repository-is-not-signed, sudo-command-not-found | 4 pages, all of §6.1's P1 list. The §6.1 P2 list is what remains. |
| `compare` | apt-vs-apt-get, cron-vs-systemd-timers, remove-vs-purge-vs-autoremove, sh-vs-bash-vs-dash, which-vs-type-vs-command | 5 of the ~20 candidates in §10.1. The first four are package management; the fifth was split out of the `which` page and is the first one written because a command page turned out to be answering two questions. |

## §3. What the evidence says

Sampled 2026-08-18 from the Stack Exchange API (top-voted questions, all time) on
`unix.stackexchange.com` and `askubuntu.com`, and from a published tally of the top 100
Stack Overflow `bash` questions. Three findings, each of which changes the plan.

### §3.1. Demand is not shaped like a command reference

Of the top 100 Stack Overflow bash questions by votes, roughly **45 are script mechanics**:
quoting, arrays, string manipulation, argument handling, conditionals, functions, parameter
expansion. Another ~8 are stream redirection and ~7 are `PATH` and shell startup files. Fewer
than 15 are "how do I use command X".

At the time of sampling the site had 19 command pages against 3 concepts and 6 lessons, a ratio
upside down relative to what people ask. **Finishing the scripting course and thickening concepts
addresses more demand than the next twenty command pages would.**

The single most-upvoted bash question of all time (+4324) is "get the source directory of a Bash
script from within the script itself", which is a lesson-9 topic rather than a command page.

**This ranking has a blind spot, and it is worth checking before every batch.** Vote counts
measure demand across every Linux user on the internet, and a command has to be *asked about* to
appear in them. Nobody asks what `cat` does, so nothing in this section could see that `cat` was
named in prose on thirty-one pages with nowhere to link, which was a larger gap than any command
here listed. The site's own link graph is a second kind of demand, and counting it is one command:
`npm run audit:links -- --verbose`. Run it when choosing a batch, not after shipping one.

### §3.2. The most repeated question shape is "what is the difference between X and Y"

From the unix.SE top 60 alone: terminal vs shell vs tty vs console (+1638), `nohup` vs `disown`
vs `&` (+813), `/usr/bin` vs `/usr/local/bin` (+720), `/opt` vs `/usr/local` (+659), `[[` vs `[`
vs `(` vs `((` (+596), login vs non-login shell (+594), `printf` vs `echo` (+740), `apt` vs
`apt-get` (+860 on askubuntu), `dpkg -i` vs `apt` (+1218), `apt-get` vs `aptitude` (+281),
`adduser` vs `useradd` (+90).

The site has no page shape for this. §10.1 proposes one.

### §3.3. Package management is the largest single cluster, and it is our name

The askubuntu top 60 is roughly 40% package management, and nearly all of it is Debian-general
rather than Ubuntu-specific:

| Votes | Question | Covered? |
|---|---|---|
| 2749 | How to list all installed packages | yes |
| 1779 | "The following packages have been kept back": why, and how do I fix it | yes |
| 1581 | How do I install a `.deb` file from the command line | yes |
| 1175 | Unable to lock `/var/lib/dpkg/`, another process is using it | yes |
| 1125 | How to upgrade a single package | **no** |
| 860 | Difference between `apt` and `apt-get` | yes |
| 819 | How do I find the package that provides a file | yes |
| 781 | Correct way to completely remove an application | yes |
| 772 | How do I remove old kernels | **no** |
| 716 | What does `apt-get update` actually do | yes |

Plus, from unix.SE: `resolv.conf` being overwritten (+369), "no public key available" on
`apt-get update` (+180), `-bash: sudo: command not found` (+176), adding a repository from the
shell (+166), listing packages by install date (+143), `gpg: keyserver receive failed: no
dirmngr` (+140), `/usr/lib/systemd/system` vs `/etc/systemd/system` (+133), "the repository does
not have a Release file" (+119), which Debian version am I running (+126).

This was the highest-leverage gap on the site when it was sampled, and it is the one nobody else
covers as well, because most of the internet writes package management for Ubuntu. It is now the
best-covered cluster here: eight of the ten questions above have a page, across `commands`,
`debian`, `troubleshooting` and `compare`. What remains of it is the §6.2 P2 list, led by
upgrading a single package (+1125) and removing old kernels (+772).

## §4. Command pages

48 written, and **no P1 left**. Below is the full candidate set, grouped as `COMMAND_GROUPS` in
`src/config.ts` groups them, with a priority marker and the reason each earns a page. Adding a
slug to `COMMAND_GROUPS` is part of shipping it, or it falls into "More commands".

**P1** = next two waves. **P2** = clear value, no urgency. **P3** = write if the surrounding
cluster gets written; not worth a page alone.

### §4.1. Debian package tooling

The §3.3 gap. Done to the P1 line; everything below it is P2 or lower.

- **SHIPPED 2026-08-18 `apt`** and **`dpkg`** (flagship each).
- **SHIPPED 2026-08-26 `apt-cache`** (standard) and **`apt-file`** (light). `apt-cache`'s fixture
  repository is what narrowed §11.1, and `apt-file` is the second-slowest page on the site.
- **P2 `update-alternatives`** (standard): default editor, `python`, `java`; the mechanism
  behind "how do I change the default X" questions.
- **P2 `dpkg-reconfigure`** (light): locales, timezone, keyboard. Debian-specific and nowhere
  else.
- **P2 `apt-mark`** (light): hold/unhold, auto/manual, the `autoremove` safety story.
- **P3 `aptitude`** (light): mostly to answer "should I use this" honestly: no.
- **P3 `debsums`, `deborphan`, `debootstrap`**: niche; `debootstrap` is interesting for a
  container/chroot article rather than a command page.

### §4.2. Processes, signals & job control

Done to the P1 line as of 2026-08-30. `lsof` is the one command still named on a page with
nothing to link to, from `kill-whatever-is-using-a-port`.

- **SHIPPED 2026-08-24 `ps`** (standard), with `pgrep`/`pidof` folded in. It needs the systemd
  sandbox, and no example on it may enumerate the whole process table: the harness's own
  `timeout … bash -c … | head` wrapper appears in one, and the console count differs between the
  devcontainer and a CI runner. Both apply to `top` and `lsof` below.
- **SHIPPED 2026-08-30 `kill`** (standard), with `pkill`, `pgrep` and `killall` folded in. It
  needs the systemd sandbox: the page kills things and then counts what is left, and under the
  default sandbox PID 1 reaps nothing, so each killed process stayed in the table as a named
  zombie and the counts climbed with the number of examples that had already run. `pkill -f`
  examples carry no output block, because the replay wraps each example in `bash -c <code>` whose
  own command line contains the pattern, so `-f` matches the harness; a verified one narrows with
  `-u`. Signal semantics stayed on the §5 concept page, and linking rather than repeating them is
  what kept this to a standard tier.
- **SHIPPED 2026-08-30 `job-control`** (standard), covering `jobs`, `fg`, `bg`, `wait`, `disown`,
  `nohup` and `setsid`. Every example redirects its background job to `/dev/null`, and not for
  neatness: a background job inherits the harness's stdout and holds that pipe until it exits, so
  one `sleep 300 &` wedges the replay for five minutes. A pipeline needs `2>&1 |` on the first
  stage as well, since a redirect on the last stage leaves the first one holding the descriptor.
  Ctrl-Z cannot be pressed by an example, so the suspend and resume pairs use `kill -STOP` and say
  so. `nohup.out` is described rather than shown, because it is written only when stdout is a
  terminal and no replay has one; what `nohup` does to the signal mask is shown instead, out of
  `/proc/$!/status`. Not the raw field, which is the CI failure this page cost: the high bits
  carry real-time signals the C library reserves, and they differ between an arm64 devcontainer
  and an amd64 runner. Masked to signals 1 to 31 it is stable by construction, and the page shows
  the masked bitmap as hex before translating it with `kill -l`, so a reader meets the bitmap first and
  the decoding second.
- **P2 `top`** (standard): reading load average, sort keys, renice in place; `htop` in a callout.
- **P2 `lsof`** (standard): open files, `-i` for sockets, deleted-but-held files eating a disk.
- **P2 `timeout` / `time` / `watch` / `sleep`** (light, combined): "run this every N seconds"
  (+658) and "how long did this take" (+751).
- **P2 `free` / `uptime` / `nice` / `renice`** (light, combined): too small alone.
- **P3 `strace`** (standard): powerful, hard to verify deterministically (§11).
- **P3 `pidof` / `pgrep`**: folded into `ps` and `kill`, and needing no page of their own.

### §4.3. Files & directories

The everyday commands. Low glamour, high traffic.

- **SHIPPED 2026-08-23 `ls`** (flagship). Built around the terminal-versus-pipe rule: every
  example is captured through a pipe, so the columned form a reader sees at a prompt is not what
  the page can show. That applies to anything below whose output changes shape on a terminal.
- **SHIPPED 2026-08-28 `cp`**, **`mv`** and **`rm`** (light each), sharing `mk_site_tree` in
  `_common.sh` with `chown`.
- **SHIPPED 2026-09-05 `ln`** (standard). Two mistakes carry the page, and both are silent:
  `ln -s style.css site/assets/wrong.css` is accepted and points at nothing, because a relative
  target is read from the directory holding the link rather than from where you typed it; and
  `ln -sf` against an existing `current` symlink creates the new link *inside* the directory that
  symlink names, which is what `-sfn` is for.
- **SHIPPED 2026-09-05 `mkdir`** and **`touch`** (light each), split rather than combined as this
  entry proposed, because each has a mistake of its own to be built around: `mkdir -p -m 700
  outer/inner` leaves `outer` at the umask default, so a directory meant to be private sits inside
  one anybody can read, and `touch -d` moves the modification time back while the change time
  jumps to now, since altering the inode is itself a change and nothing can set that one.
  **`mktemp` is dropped rather than left outstanding**: the scripting course already teaches it on
  four lessons, `traps-and-cleanup` and `a-real-script` among them, which is where a reader meets
  the problem it solves.
- **SHIPPED 2026-09-05 `cd`** (light), on no backlog in this document, like `cat` before it. The
  replay names its working directory after the page, so no example may print `pwd` from it: the
  page shows basenames and fixed system paths instead, the answer `where-a-script-lives` and
  `sudo` both reached independently.
- **P2 `stat` / `file` / `basename` / `dirname` / `realpath`** (standard, combined as "inspecting
  files and paths"): the last three are constant in scripts. With `ln`, `mkdir` and `touch`
  written, this is the last of the everyday file commands and `COMMAND_GROUPS` already reserves
  `inspect-files` for it.
- **P2 `tree`** (light): not installed by default; worth saying so.
- **P3 `shred`** (light): and the honest SSD caveat, which is really a recipe.
- **P3 `install`** (light): the underused mkdir+cp+chmod+chown in one.

### §4.4. Text processing: filling out a strong group

- **SHIPPED 2026-08-28 `cat`** (standard). No backlog here listed it; the link audit found it.
  See §3.1, which is the general form of that miss.
- **SHIPPED 2026-08-23 `xargs`** (flagship).
- **SHIPPED 2026-08-19 `tee`** (light).
- **P2 `paste` / `join` / `comm`** (standard, combined): set operations and column merging; the
  "which lines are in A but not B" job people do badly with grep.
- **P2 `column` / `fmt` / `fold` / `nl` / `rev` / `expand`** (light, combined as "formatting text
  for reading"): small tools, one page.
- **P2 `split` / `csplit`** (light): chunking large files.
- **SHIPPED 2026-08-19 `jq`** (flagship): not in Debian's base install, so the page says so and
  then teaches it.
- **P3 `iconv` / `strings` / `od` / `xxd`** (light, combined): encoding and binary inspection;
  pairs with a locales concept page.
- **P3 `printf`**: better as part of a scripting lesson than a command page ("why printf is
  better than echo", +740).

### §4.5. Users, groups & privilege

- **SHIPPED 2026-08-31 `sudo`** (standard), with `su` folded in. Chosen off-wave because the
  link graph asked for it: `sudo` was named in prose on twelve pages with nowhere to link, the
  largest such gap on the site and the same signal §3.1 describes finding `cat` by. It replays as
  `user`, since as root every refusal the page is about cannot happen. The image already grants
  `user` passwordless sudo, so the setup script adds one `PASSWD:` rule for a single command to
  give `-n` something to refuse; that rule has to sort *after* the image's `NOPASSWD: ALL` in
  `/etc/sudoers.d` and name a command no other example runs, or it makes an unrelated example ask
  for a password nothing can answer.
- **SHIPPED 2026-08-28 `chown`** (light), with `chgrp` folded in. It replays as root, unlike the
  three pages it shares `mk_site_tree` with, because every example doing its subject needs the
  privilege; the refusals are shown with `sudo -u user` from that root shell. The same will be
  true of the `adduser` page below.
- **P2 `adduser` / `useradd` / `usermod` / `deluser`** (standard, combined): including the
  Debian-specific "`adduser` is the one you want, `useradd` is the low-level one" (+90).
- **P2 `id` / `groups` / `who` / `w` / `last`** (light, combined): who am I, who else is here.
- **P2 `passwd` / `chage`** (light): changing, locking, expiring.
- **P3 `getfacl` / `setfacl`** (standard): POSIX ACLs, when the nine bits aren't enough.
- **P3 `chattr` / `lsattr`** (light): `+i` immutable, an occasional real answer.

### §4.6. Disk & storage

- **SHIPPED 2026-08-24 `du`** (standard), on `mk_projects` in `_common.sh` plus a sparse file and
  a hard-linked pair. It needed no loop device, which is why it and `df` were pulled out of
  Wave 8.
- **SHIPPED 2026-08-31 `df`** (light). 24 checked outputs, and it needed more harness than this
  entry predicted. A container's root filesystem is `overlay` on the host's disk, so the ordinary
  output is a size that differs between a devcontainer and a runner under a name no reader has.
  The page measures two `tmpfs` filesystems the setup script mounts instead, with `size=` and
  `nr_inodes=` both pinned, so every figure printed is one the fixture chose. Mounting needs
  CAP_SYS_ADMIN, so it asks for `--systemd`, the only flavour that runs `--privileged`.
  `nr_inodes=32` is what makes the inode-exhaustion block real rather than described: 31 files,
  then `No space left on device` on a filesystem reporting 0% used.
- **P2 `mount` / `umount` / `lsblk` / `blkid`** (standard, combined): reading `/etc/fstab`,
  what a bind mount is (+620).
- **P2 `rsync`** (flagship): already referenced by `copy-files-between-machines` with no page.
  `-a -v -z --delete --dry-run`, over ssh, the trailing-slash rule.
- **P3 `dd`** (standard): with `status=progress` (+886 on askubuntu) and heavy `danger: true`.
- **P3 `fdisk` / `parted` / `mkfs` / `fsck`**: see §11; needs loop devices to verify.
- **P3 `ncdu`** (light): the friendly `du`; not installed by default.

### §4.7. Networking & diagnostics

Verification, rather than the writing, is the constraint here. See §11.3. `ss` was the exception
and is written; everything below it still waits on a resolver fixture or a real peer.

- **SHIPPED 2026-09-02 `ss`** (standard). 53 checked outputs, and the fixture is four small
  Python services rather than whatever the machine was already listening on, so every socket the
  page prints is one it created: two TCP listeners with deliberately different backlogs, so the
  page can say what `Send-Q` means on a listening socket, plus UDP, a Unix socket and one
  established pair.

  Two things it settled that the next network page will meet. The listeners take a direct
  `#!/usr/bin/python3` shebang, because a process is named after the file the kernel was told to
  execute, and going through `env` means `ss -p` reports five processes all called `python3`.
  And the order two listening sockets are printed in is settled per network namespace, which
  ADR-0026 and `unordered:` exist to handle: six fresh containers here split three each way, so
  the page had an even chance of passing wherever it ran.
- **P2 `ip`** (flagship): `addr`/`route`/`link`; the `ifconfig` replacement everyone still
  googles.
- **P2 `dig` / `host`** (standard): record types, `+short`, reverse lookups. Needs a local
  resolver fixture (§11.3).
- **P2 `scp` / `sftp`** (light): and when to use `rsync` instead; "copy files from one machine
  to another" is +1340.
- **P2 `ping` / `traceroute` / `mtr`** (light, combined).
- **P3 `nc`** (standard): the Swiss army knife, mostly for the local-testing use case.
- **P3 `openssl s_client`** (light): checking a certificate, expiry, chain.
- **P3 `tcpdump`** (standard): real value, hard to make deterministic.
- **P3 `ufw` / `nftables`**: better as a Debian article than a command page.

### §4.8. Shell, environment & terminal

- **SHIPPED 2026-08-28 `less`** (standard), alone rather than combined with `man`.

  **The shape it settled applies to every interactive command still on this backlog** (`man`,
  `top`, `nano`, `vim`, `tmux`). The half a reader wants is keystrokes, and no example can show
  one: driving `less` under a pseudo-terminal with `script -qec` hangs waiting for a key, which
  wedges a replay rather than failing it. So the keys are a table in the page body, checked
  against the command's own `--help` in the sandbox, and `examples.yaml` carries only what
  produces output. Thirteen of its twenty-eight examples have none, which is the shape `ssh` and
  `crontab` already have.
- **SHIPPED 2026-09-02 `man`** (standard), with `apropos` folded in, since one displays a page and
  the other is how you find out which page to ask for. 50 checked outputs, and it took the shape
  `less` settled above.

  The section numbers got the most room, because an unqualified lookup takes the lowest-numbered
  section that has a page and that is where people lose time; `passwd` is the demonstration, with
  section 1 changing a password and section 5 the file it writes. Section 3 is shown *failing*,
  because Debian ships sections 2 and 3 in `manpages-dev` and the error is the result a reader is
  likelier to meet. Its setup script asserts two states rather than building anything: that
  `manpages-dev` is absent, since an example whose point is an absence has to establish it, and
  that the `whatis` index exists, since `apropos`, `whatis` and `man -k` all read that index and
  answer "nothing appropriate" without it.
- **SHIPPED 2026-09-05 `which`** (light), on no backlog here. It was written as one page and split
  after the fact: 24 examples of which only six led with `which`, so the comparison page now owns
  the limit and the alternatives, and the command page keeps `PATH` order and the fact that
  Debian's `which` is a shell script from `debianutils`. The demonstration both halves are built
  on is that `which cd` reports `cd` does not exist.
- **P2 `date`** (standard): formatting, `-d` parsing, epoch conversion, ISO 8601. Constant in
  scripts and in `find -newermt`.
- **P2 `history` / `alias` / readline keys** (standard, combined): `Ctrl-R`, `!!`, `!$`,
  `Ctrl-A/E/U/W`, preserving history across terminals (+733). Very high beginner value.
- **P2 `tmux`** (flagship): pairs with the written `ssh` page; "keep processes running after
  ending ssh session" is +1044.
- **P2 `env` / `export` / `printenv`** (light, combined): the mechanics under the environment
  concept page.
- **P3 `seq` / `yes` / `true` / `false`** (light, combined): mostly interesting inside scripts.
- **P3 `screen`**: mention in the `tmux` page rather than its own.

### §4.9. Editors

- **P2 `nano`** (light): Debian's default; the friendly answer, kept short.
- **P2 `vim` basics** (standard): modes, save and quit, the minimum to survive a server.

### §4.10. Archives: finishing the group

- **P2 `gzip` / `gunzip` / `zcat` / `xz` / `zstd`** (standard, combined): standalone compression
  vs `tar -z`, and which to pick.
- **P2 `zip` / `unzip`** (light): the Windows-interop case; +2317 on askubuntu for "how to unzip".

## §5. Concept pages

4 written, and §3.1 says this is still where the demand actually is. Ordered by evidence.

- **SHIPPED 2026-08-23 Environment variables, `PATH`, and shell startup files.**
- **SHIPPED 2026-08-27 `concepts/terminal-shell-and-tty`** (+1638, +974). The harness has no
  terminal, and `script -qec '<command>' /dev/null` gives one block a pseudo-terminal and not the
  next, so the page shows the same command answering differently either side of that line. Two
  limits, for any page that tries it: the pty is always `/dev/pts/0`, and `stty size` reads `0 0`,
  which rules out anything depending on terminal width.
- **SHIPPED 2026-08-27 `concepts/processes-and-signals`** (+813, +656). Takes the SIGHUP story,
  because the answer to +813 is a fact about signals rather than about commands.

  **The scope boundary it set is still live**, because two of the pages it divides from are
  unwritten. Four planned pages were pointing at one cluster and three claimed +813 outright; the
  split is by the reader's question rather than the topic:

  | Question | Page |
  | --- | --- |
  | What is actually happening? | this page |
  | What do I type? | §4.2 `jobs`/`fg`/`bg`/`nohup`/`disown`, and §4.2 `kill`/`pkill`/`killall` |
  | How do I keep this running after logout? | §9 recipe, +1044 |

  So the two §4.2 pages name flags and link here for the why, and neither re-explains process
  groups.
- **P2 Regular expressions: BRE vs ERE vs PCRE**: unifies the regex flags scattered across
  `grep`, `sed` and `awk`. The `regex` tag exists with no page owning it.
- **P2 The filesystem hierarchy**: `/etc`, `/var`, `/usr`, `/opt`, `/usr/local`, `/srv`,
  `lost+found`. Three separate top-questions (+837, +720, +659) are this page.
- **P2 Links, inodes and what a filename really is**: hard vs symbolic links, why `rm` on a
  running program's binary is fine, why `mv` across filesystems is a copy.
- **P2 Users, groups, `/etc/passwd` and `/etc/shadow`**: supports §4.5.
- **P2 Globbing is not regex**: `*` and `?` in the shell vs in `grep`, brace expansion, word
  splitting, and where the shell stops and the command starts. A constant source of confusion
  that no single page owns.
- **P2 Locales, character encodings, and why `sort` changed its answer**: `LC_ALL=C`, UTF-8 vs
  Latin-1, `dpkg-reconfigure locales` on Debian. Decides the answer `sort` gives, and almost never
  written about clearly.
- **P3 Standard streams, buffering and why `grep` on a live stream shows nothing**: line vs
  block buffering, `stdbuf`, `--line-buffered`. Small but the +630 question.
- **P3 File timestamps: atime, mtime, ctime**: and why there is no creation time.
- **P3 Time, clocks and timezones**: `timedatectl`, NTP, UTC vs local, hardware clock.
- **P3 How Linux boots**: firmware → GRUB → initramfs → systemd → your login. Orientation piece.
- **P3 How package management fits together**: dpkg, apt, and the `.deb` file. May belong in
  `debian/` instead; decide when writing.

## §6. Debian articles

This section spans three categories rather than one: §10.0.1 bounds `debian/` to the explainer
shape, so the error-driven layer goes to `troubleshooting` and the "X vs Y" items to `compare`.
It has produced **7 pages in `debian/`, 4 in `troubleshooting/`, 2 in `compare/`.**

### §6.1. Error-driven

Each of these is a real error string people paste into a search box, so the page title is the
error string. They live in `troubleshooting`, tagged `debian` and `apt`.

- **SHIPPED 2026-08-18**, all four P1 pages: "packages have been kept back" (+1779), "Could not
  get lock /var/lib/dpkg/lock-frontend" (+1175), "sudo: command not found" (+176, pure Debian)
  and "NO_PUBKEY" / repository is not signed (+180).
- **P2 "The repository does not have a Release file"**: usually a codename that no longer exists,
  or a repo that never supported your suite. +119.
- **P2 "dpkg: error processing package (--configure)"** and recovering a half-configured system.
- **P2 "Unmet dependencies" / "broken packages"**: what apt is actually telling you.
- **P2 "No space left on device" when `df` says there is**: inodes, or a deleted file still held
  open. Pairs with `df -i` and `lsof`.

### §6.2. Package management, conceptual

All five P1 items are written. Two took the `compare` template rather than the article one,
because both were "X vs Y" in shape, which is §10.0.1 working.

- **SHIPPED 2026-08-18 `compare/apt-vs-apt-get`** (+281, +1218, +860).
- **SHIPPED 2026-08-20 `compare/remove-vs-purge-vs-autoremove`** (+781).
- **SHIPPED 2026-08-26 `debian/list-installed-packages`** (+2749, +143),
  **`debian/install-a-deb-file`** (+1581, +1218) and **`debian/which-package-provides-a-file`**
  (+819). `install-a-deb-file` is written against a fixture package rather than a real download,
  because `dpkg -i` and `apt install` only diverge when a dependency is missing and nothing in the
  archive can be relied on to be absent.
- **P2 Holding a package back, and pinning**: `apt-mark hold`, `/etc/apt/preferences.d`,
  pinning to a specific repo. Follows naturally from release-channels.
- **P2 Upgrading a single package without upgrading everything**: +1125, and the honest answer
  about why that is often not possible.
- **P2 Cleaning up: old kernels, the apt cache, orphaned config**: +772, and the one where bad
  internet advice makes systems unbootable.
- **P2 The deb822 sources format**: `.sources` files, replacing the one-line format, what each
  field does. Debian 12+ ships it and most tutorials still predate it.
- **P2 Upgrading between Debian releases**: the full `stable` to `stable` workflow and where it
  bites.
- **P2 Automatic security updates with `unattended-upgrades`**: including its role in §6.1's
  lock contention.
- **P3 Building a simple `.deb`**: `dpkg-deb`, or `equivs` for a metapackage. Niche but nothing
  else covers it for a beginner.

### §6.3. Debian as a system

- **P1 Which Debian am I running, and what do the codenames mean**: `/etc/os-release`,
  `/etc/debian_version`, `lsb_release`, and the Toy Story naming. +126.
- **P2 Debian's file layout conventions**: `/etc/default`, `/etc/systemd/system` vs
  `/usr/lib/systemd/system` (+133), conffiles and what `ucf` does, why editing a package's file
  is different here.
- **P2 Networking on Debian: `/etc/network/interfaces`, NetworkManager, systemd-networkd**: which
  one is managing your interface, and the `resolv.conf` gets overwritten question (+369).
- **P2 Firmware and the non-free-firmware component**: Debian 12 changed this; the wifi-doesn't-
  work experience. +115.
- **P2 systemd timers as the cron replacement**: partly covered in the systemd article; deserves
  its own with a full worked migration.
- **P3 Debian on a server: a minimal install, tasksel, what to remove**: opinionated setup piece.
- **P3 Alternatives to systemd on Debian**: sysvinit is still supported; short and factual.
- **P3 Debian's release process and the freeze**: how testing becomes stable, why that matters
  when choosing a suite.

## §7. Scripting course: complete

**All fourteen lessons shipped, the last six on 2026-08-29.** §3.1 rated this course above
anything else on the site on demand, and it is the first backlog in this document to reach the
end of its own list.

The shape that came out of it: lessons 1 to 6 are the language, 7 to 8 are what a script does
with the values it holds, 9 to 13 are the script as a running program, and 14 is a working tool
that uses all thirteen. The capstone shows its own source with `cat backup.sh`, so the listing a
reader reads is checked against the file that ran, which is worth copying for any page that
publishes a script.

Two candidate additions remain, neither of them a gap a reader would notice:

- **Reading input safely** (`read -r`, `IFS`, the `while read` loop, prompting for yes/no;
  +1245, +633, +503). Partly covered by lesson 4 already, and the case for splitting it out is
  that the +1245 question is asked as its own thing.
- **Subshells, `set -e` scope, and when a pipeline runs where.** Subtle, and the root cause of a
  whole class of "why didn't my variable survive the loop" confusion. Lessons 4 and 12 both point
  at it without owning it, which is the argument for a page.

Anything added here takes an `order:` after 14, or the capstone stops being the last thing a
reader meets.

## §8. A Perl track

Requested, and it holds up better than expected once the framing is right.

### §8.1. The case, and the framing

Verified in the sandbox on Debian 13:

```
Package: perl-base   Essential: yes   Priority: required   Version: 5.40.1-6
Package: python3                      Priority: optional
```

`perl-base` is **Essential**, which means dpkg will refuse to remove it without an explicit
override, and `Priority: required` means it is on every Debian system including a `debootstrap`
minimal install. `python3` is `optional`. That is the pitch, and it is a Debian-specific pitch
no general Linux site can make as sharply: *on a Debian box you have not set up, in a rescue
shell, in a minimal container, `perl` is there and `python3` may not be.*

So the track is **not** "learn Perl". It is "the text-processing tool you already have, for the
jobs where `sed` and `awk` run out". The audience is someone who knows `sed` and `awk` from this
site's own pages and has hit a wall: non-greedy matching, lookahead, `\d`, multiline, in-place
edits across many files, counting into a hash.

This also makes the track's verification cheap: Perl one-liners are self-contained, deterministic
text transformations with no system state, the single best-suited content on this whole plan for
the replay harness (§11.4).

### §8.2. Pages

1. **Perl is already installed** (intro): `Essential: yes`, `perl-base` vs `perl` vs
   `libfoo-perl` packages, what on your system already depends on it (`debconf`, much of
   `dpkg`'s tooling), and why that means a one-liner is always available. Sets the whole frame.
2. **Perl one-liners** (flagship, the headline page): `-e`, `-n`, `-p`, `-l`, `-a`/`-F`, `-i`,
   `-0777`, and the classic catalogue: print matching lines, substitute across files, sum a
   column, join lines, deduplicate, number lines, extract with a capture group. 50+ examples,
   every one replayed. This is the page the track exists for.
3. **Perl for people who know sed and awk**: a translation table both ways, and an honest section
   on when *not* to reach for Perl (`sed s///` is shorter and clearer for a simple substitution).
4. **Regular expressions in Perl**: what PCRE buys you over ERE: `\d\w\s`, non-greedy `*?`,
   lookahead and lookbehind, named captures, `/x` for readable patterns, `/s` and `/m`. Pairs
   directly with the regex concept page in §5.
5. **Editing files in place**: `-i` and `-i.bak`, across a whole tree with `find -print0` and
   `xargs -0`, and how to dry-run it first. This is the "recursive find and replace" question
   (+588, +956, +982) answered properly.
6. **Beyond one line at a time**: slurp mode, paragraph mode, `$.`, `eof`, handling multiple
   files, and the multi-line matching that `sed` makes painful.
7. **Counting and reporting with hashes**: the word-frequency and log-summary jobs, sorting a
   hash by value. The natural "awk arrays but nicer" page.
8. **From one-liner to script**: when the one-liner has outgrown itself: `use strict; use
   warnings;`, the shebang, `@ARGV`, and `perl -MO=Deparse` to see what your one-liner really
   meant.
9. **P3 CPAN, and why you should prefer `apt` on a server**: `libjson-perl` vs `cpanm`, where
   each installs, and how that interacts with system upgrades. Debian-specific and rarely
   written well.

### §8.3. Where it lives: a decision is needed

`scripting` is a single ordered course (`order:` drives prev/next, uniqueness enforced per
category). A Perl track is a *second* course, so it cannot simply share that category. Options:

- **(a) A `perl` category.** Cheapest: the loader's ordering rule is currently special-cased to
  `scripting` and would be generalised to "any category that uses `order:`". Gives Perl a nav
  entry, which is distinctive for the site and honest about the content being a track.
- **(b) A `track:` field**, so one category can hold several ordered sequences. More flexible, and
  the right answer if a third course ever appears (a sysadmin fundamentals track, say). Costs a
  schema change, loader changes, prev/next changes, and listing-page changes.

Recommendation: **(a) now, (b) if and when a third course appears.** Generalising the `order:`
rule is a small, well-tested change; inventing a track abstraction for two courses is speculative.

## §9. Recipes

9 written, and **all four P1 items shipped 2026-08-29**. Recipes are the natural home for the
"how do I do X" half of §3, and each one is cheap. Ordered by demand.

- **SHIPPED 2026-08-29 `add-a-directory-to-path`** (+1412 / +1001 / +724). The Debian answer is
  not the internet's: the stock `~/.profile` already tests for `~/bin` and `~/.local/bin`, so the
  common case is creating a directory rather than editing a file.
- **SHIPPED 2026-08-29 `find-and-replace-across-files`** (+956 / +982 / +588).
- **SHIPPED 2026-08-29 `keep-a-program-running-after-logout`** (+1044). Third of the three pages
  the §5 scope table divides, and written to that division: it recommends first and sends the
  reader to the concept page for why the alternatives differ rather than explaining SIGHUP again.
- **SHIPPED 2026-08-29 `find-permission-denied`** (+749). The exit-status callback the entry
  predicted turned out to be the strongest thing on the page: `! -readable -prune` exits 0 where
  `2>/dev/null` still exits 1.
- **P2 Save everything a terminal session prints**: `tee`, `script`, and the difference. +1448.
- **P2 Find what is listening on a port**: exists as `kill-whatever-is-using-a-port`; extend or
  cross-link once `ss` and `lsof` have pages.
- **P2 Compare two directory trees**: `diff -rq`, `rsync -n`, checksums. +682.
- **P2 Parse JSON on the command line**: `jq` basics for the four things people actually need.
  +681.
- **P2 Generate a random password or string**: `/dev/urandom`, `openssl rand`, `pwgen`, and
  which are actually safe. +674.
- **P2 Free up disk space when the root filesystem is full**: `du` walk, apt cache, journal
  vacuum, old kernels, deleted-but-open files. +838, and ties four other pages together.
- **P2 Work out why your ssh key isn't being accepted**: permissions on `~/.ssh`,
  `authorized_keys`, `ssh -v` reading, server-side `AuthorizedKeysFile`. +746, and one of the
  best troubleshooting recipes available.
- **P2 Run something every N seconds, or at a specific time**: `watch`, `sleep` loops, cron,
  systemd timers, and which to choose. +658.
- **P2 Rotate and manage log files**: `logrotate`, and how Debian packages ship their configs.
- **P2 Serve a directory over HTTP for two minutes**: `python3 -m http.server`, and the
  security caveat.
- **P2 Time how long something takes**: `time` builtin vs `/usr/bin/time`, and what the three
  numbers mean. +751.
- **P2 Automate a rotating backup**: `tar` + `find -mtime` + retention, scheduled. Ties three
  written pages into one workflow.
- **P3 Extract any archive, whatever the format**: the dispatch table, and `bsdtar`.
- **P3 Unfreeze a terminal after Ctrl-S**: tiny, but +974, and it belongs to the §5 terminal page.
- **P3 Count lines of code in a project**: +1414; `cloc` is the honest answer.
- **P3 Wait for several background jobs and collect their exit codes**: +464; may belong in the
  scripting course instead.
- **P3 Securely delete a file**: `shred`, and the honest SSD/COW-filesystem caveat.

## §10. New categories

Seven content categories exist. `compare` (§10.1) and `troubleshooting` (§10.2) were built;
§10.3's glossary and §10.4's `order:` change are still open. §10.0 is the rule that decides
whether an eighth is worth having.

### §10.0. The taxonomy has two axes, and neither of them is a subcategory

The site already sorts every page twice, on axes that are genuinely independent:

- **`category` is the page's *shape***: how it is written, and how a reader consumes it. A
  command reference, an explainer, a course lesson, a task.
- **`tags` are the page's *subject***: networking, apt, permissions. Many-to-many, with a
  listing page per tag at `/tags/<name>/` that already renders the tag's `description` from
  `content/tags.yaml` as a lede.

A subcategory would be a third axis, and in almost every case it would restate the second one.
`/commands/networking/` and `/tags/networking/` would hold nearly the same pages, except the
tag version is many-to-many, which is correct: `rsync` is a networking command *and* a files
command, and a subcategory would force a choice that has no right answer.

So the scaling answer for a 60-page `commands` listing is **not** a new field. It is:

- `COMMAND_GROUPS` in `src/config.ts` for on-page grouping, which already exists and already
  does this job.
- Richer `description` text in `tags.yaml` for the tag pages, which are already the de facto
  subject index and already display it. Cheapest available improvement to navigation.

The one place hierarchy is genuinely needed is an **ordered sequence**, where "which lesson is
next" is information neither axis carries. That is a narrow, separate problem, and §10.4 is where
it belongs.

**Cost of more categories, and how to pay it.** The real risk of eight categories is not reader
confusion, it is *author* confusion: a future session writing "how do I fix a stuck apt lock"
needs to file it without deliberating. So each category gets a one-line test, phrased as what the
reader arrived with:

| Category | The reader arrives with | Test |
|---|---|---|
| `commands` | a tool's name | "I know it's `xargs`, I want to use it well." |
| `concepts` | a why | "But how does that actually *work*?" |
| `scripting`, `perl` | nothing yet | Read in order; each page assumes the last. |
| `recipes` | a goal | "I want to achieve X." |
| `troubleshooting` | an error message | "X broke, and here is what it printed." |
| `compare` | two options | "X or Y, and nobody told me how to choose." |
| `debian` | a why, about Debian | An explainer that would be *wrong* elsewhere. |

Two tiebreaks that resolve the awkward cases:

- **Goal or error?** `recipes` and `troubleshooting` split on how the reader arrived, not on
  subject. "Free up disk space" is a recipe; "No space left on device" is troubleshooting. The
  same knowledge, two entry points, and both are worth having.
- **Does it survive deletion?** If a comparison page still says something useful with one of its
  two subjects removed, it is a concept page wearing a comparison title.

### §10.0.1. Why `debian` sits on the subject axis

Worth naming, since it is the model's one inconsistency. `debian` sits on the subject axis while
every other category sits on the shape axis, which is why it drifts toward absorbing anything
Debian-flavoured, and with §6 as written it would have absorbed twenty pages.

Keep it, because the site is called debian.tips and a `/debian/` section is a product decision
rather than a taxonomy one. But bound it: **`debian` is the Debian wing of `concepts`**, the
explainer shape, on a subject that would be wrong on a non-Debian system. Everything else with a
Debian subject takes the `debian` **tag** and files under its shape.

Applied to §6: the error pages are **`troubleshooting`**, `dpkg vs apt vs aptitude` is
**`compare`**, and `release-channels` and `systemd-services` stay where they are. The rule keeps
`debian` at a browsable dozen instead of a sprawl.

### §10.1. `compare`, the "X vs Y" pages: **BUILT**

§3.2 established this as the most repeated question shape on unix.SE. Template: **what each one
is → what actually differs → when to use which → the honest verdict**, 400–800 words.

**The rule that keeps the category honest**: every page carries at least one real demonstration of
the difference (`echo` vs `printf` on `\n`, `[` vs `[[` on an unquoted empty variable, `remove` vs
`purge` on a leftover conffile). All five written so far have a setup script and replay. Without
it a comparison page is an unverifiable opinion piece, which is the failure mode to watch for.

**Five written**, and the original list of nineteen candidates now divides three ways. What
decides which pile a candidate is in is whether the command pages under it exist: a comparison
written before them has to teach both commands from scratch to make its point, and a comparison
written after them is a paragraph on each and then the demonstration.

**Writeable now**, every page under them written:

- hard vs symbolic links (`ln`)
- `ss` vs `netstat` (`ss`)
- `su` vs `sudo -i` vs `sudo -s` (`sudo`, which folded `su` in)
- `nohup` vs `disown` vs `&` vs `tmux` (`job-control`, `kill`, `processes-and-signals`), with the
  caveat the `keep-a-program-running-after-logout` recipe already found: `tmux` is not installed
  on a base Debian system, and a page recommending it first has to say so
- `[` vs `[[` vs `((` vs `test` (`scripting/conditionals-and-test`)
- `>` vs `>>` vs `tee` (`tee`, `concepts/pipes-and-redirection`)
- `grep` vs `egrep` vs `grep -E` (`grep`)
- `apt upgrade` vs `full-upgrade` vs `dist-upgrade` (`apt`)
- login vs non-login vs interactive shells (`concepts/environment-variables-and-path`,
  `concepts/terminal-shell-and-tty`)

**Still waiting on a command page or a concept page**: `apt` vs `apt-get` vs `aptitude` vs `dpkg`,
of which `apt-vs-apt-get` is already the written half and `aptitude` is a §4.1 P3; `/opt` vs
`/usr/local` vs `/usr/bin`, which wants the §5 filesystem-hierarchy page under it; `rsync` vs
`scp` vs `sftp`; `ip` vs `ifconfig`; `printf` vs `echo`, which §4.4 argues belongs in a lesson
instead; `useradd` vs `adduser`, behind the §4.5 P2.

**Retired**: `terminal` vs `shell` vs `tty` vs `console`, which `concepts/terminal-shell-and-tty`
answered on 2026-08-27. A comparison page beside it would be the same content under a second URL,
and §10.0 is the rule that says so.

That is fifteen pages of high-intent, low-competition content that also functions as an internal
linking hub: every comparison page naturally links to two or three command pages. The `which` page
is the demonstration of how the two shapes divide. Written as one page, it spent eighteen of its
twenty-four examples on commands other than `which`; split, the comparison owns the limit and the
alternatives and the command page keeps `PATH` order.

### §10.2. `troubleshooting`, pages named after the error: **BUILT**

The distinguishing feature is the *entry point*: a recipe is "I want to do X", troubleshooting is
"X broke and here is the message". People paste the error verbatim into a search box, so the page
title is the error string.

Template: **the message → what it actually means → the check that tells you which cause you have
→ the fix for each → how to avoid it**.

**The rule that keeps the category honest**: the page reproduces its error in the sandbox rather
than quoting it. An error message is a deterministic output, which is why this category suits the
harness better than any other. All four do this. Four pages exist; the §6.1 P2 list is what
remains, and §9 has several more candidates.

### §10.3. A glossary: **not started**

Short cross-linked definitions: inode, daemon, PID 1, shell, tty, package, conffile, unit,
FHS, umask, signal, file descriptor, symlink, suite, backport. Low cost per entry, good for
beginners and long-tail search.

Recommendation: **one page with heading anchors, not a category.** `src/linkcheck.ts` already
validates `#fragment` links against real `id`s, so `[conffile](/glossary/#conffile)` is checked
by the existing gate for free. A category of 40 two-paragraph pages would flood every listing and
trip the link audit's thin-page rule immediately.

### §10.4. Ordered sequences: the one case for hierarchy

`order:` and prev/next are special-cased to `scripting` in `src/content/loader.ts`. A Perl track
is a second course, so it needs *something*. Two changes, and only the first is worth making now:

1. **Generalise `order:` to any category** (do this). The uniqueness check becomes per-category
   rather than scripting-only, and prev/next follows. Small, well-covered by
   `test/build.test.ts`'s existing prev/next assertions, and it gives `perl` a working course
   with no new concepts in the model.

   **Not done, and it is the whole of what blocks Wave 4.** `src/content/loader.ts` special-cases
   the literal `"scripting"` in eight places: the type definitions, the sort comparator, the
   duplicate-order check and the prev/next pass. Nothing else in the backlog needs this change, so
   it is Perl's entry fee rather than groundwork already laid.
2. **A `track:` field** (do *not* do this yet). Only needed to run two ordered courses inside one
   category, which nothing requires. If it ever lands, default `track` to the category name so no
   existing page changes.

This is the whole of the hierarchy the site needs. It is worth noticing that it is a sequence
problem rather than a taxonomy one, which is why it does not want a subcategory either.

### §10.5. Nav: **SETTLED**

`src/config.ts` carries `NAV_GROUPS` alongside `NAV_ORDER`, collapsing the seven categories into
two nav items: **Commands**, and **Guides** holding concepts, scripting, recipes, troubleshooting,
compare and debian. An eighth category joins a group rather than adding a nav item, so nothing
further is needed when one lands. Too many top-level items is a navigation problem with a
navigation fix, never a reason to reshape the content model.

### §10.6. Considered and not recommended

- **Containers/Docker**: the old plan left this as an open question. Recommendation: **no**, with
  one exception. It is a different site's subject, and the sandbox harness cannot verify container
  behaviour from inside a container. The exception is Debian-specific: *"what `debian:trixie`
  actually contains, and how it differs from an installed Debian"* (`policy-rc.d`, no systemd, no
  `sudo`, Essential-only): a genuinely Debian article, and one this project has learned the hard
  way while building the harness.
- **A `hardware` category**: `lspci`, `lsusb`, `sensors`, `smartctl`. All unverifiable here
  (§11.2). Individual commands can appear in §4 with heavily-caveated examples, but a category
  would advertise coverage the harness cannot back.
- **News/release notes**: perishable, and the site's whole promise is content that is re-checked
  rather than content that is current.

## §11. What the harness cannot verify

Several attractive items above are blocked or constrained by the verification setup, and knowing
which *before* a batch starts is worth more than discovering it halfway through.

A constraint this section does not cover, because it is about *when* rather than *what*: the
harness verifies every page against one pinned Debian release, and says nothing about whether that
pin is still current or whether a page holds on any other release. `PLAN-DEBIAN-VERSIONS.md` has
the measurements and the options. The part that matters for content planning is that the pages
this plan prioritises (§4.1, §6.2, the whole apt and dpkg cluster) are the ones that differ most
between releases, so the version question grows with exactly the work the waves put first.

### §11.1. Architecture may never appear in output

`arm64` on the devcontainer, `amd64` on the CI runner, no emulation available locally: any block
printing an architecture fails in exactly one of the two places. ADR-0004 is the decision and
`test/architecture.test.ts` enforces it. The map below is per command, because "no package
tables" is both too broad and too narrow.

**Genuinely impossible**, because the architecture *is* the output: `uname -m`, `arch`,
`dpkg --print-architecture`, `lscpu`, and `file` on a compiled binary. Filtering cannot help, and
masking the value would leave the example checking nothing.

**Safe, and the answer most of the time:**

| Command | Why it holds everywhere |
| --- | --- |
| `dpkg-query -W -f='${Package}'` | the bare name, never qualified |
| `apt-mark showmanual` and `showauto` | never qualified |
| `/var/log/dpkg.log` | dpkg records the *package's* architecture, so an `Architecture: all` package reads `:all` on both machines |
| `dpkg -s`, `dpkg -l`, `apt show`, `apt list --installed` narrowed to an `all` package | the `Architecture` field really is `all` |
| `apt-cache policy` against a fixture repository declaring `Architectures=all` | its index is named `all`, so the source line is identical on both machines |

**Blocked, with the trap in each:**

| Command | What goes wrong |
| --- | --- |
| `dpkg-query -W -f='${binary:Package}'` | appends `:amd64` to every multi-arch package, roughly half a normal install, and leaves the rest bare |
| `dpkg --get-selections` | the same qualifier on the same packages, which rules out the usual "copy my package list" recipe |
| `/var/log/apt/history.log` `Install:`, `Remove:`, `Upgrade:` and `Purge:` lines | apt records the *host* architecture on every package, `Architecture: all` ones included, so a package that is not arch-specific at all still reads `bash-completion:arm64`. The `Start-Date:`, `Commandline:`, `Requested-By:` and `End-Date:` lines are safe |
| `apt-cache policy` version table against Debian's own indexes | Debian publishes an index per architecture, so the source line names one |
| `dpkg -l` and `apt list --installed` unfiltered | whichever arch-dependent packages the listing reaches |

The two logs differ in a way that is easy to get backwards. dpkg records the package's own
architecture, so an `Architecture: all` package is publishable from `dpkg.log`; apt records the
host's, so nothing in an `Install:` line ever is.

**One trap is not a string at all.** `${Installed-Size}` names no architecture and still differs
between them, because the same source builds to different sizes, so a listing ordered by size
returns a different few packages on each machine. `test/architecture.test.ts` scans documented
output for architecture *names* and cannot see this class. Only the replay can, and only by
running on both.

### §11.2. No hardware, and no real network peers

The sandbox has no physical disks, NICs, PCI devices or sensors. `lsblk`, `lspci`, `lsusb`,
`smartctl`, `ethtool`, `sensors`, `fdisk -l` and `ip link` against a real interface all print
either nothing or the container's synthetic view. `mount`/`fdisk`/`mkfs` can be demonstrated
against a **loop device** (`losetup` on a file), which works in a privileged container. That is
a concrete piece of harness work rather than a blocker, and it would unlock most of §4.6.

### §11.3. DNS and outbound network are not guaranteed

`dig`, `host`, `ping`, `traceroute` and `openssl s_client` all need something to talk to. The
established pattern is `scripts/fixtures/http-mock.py`, a deterministic local server the curl
and wget pages point at. The equivalent for §4.7 is a **local resolver fixture** serving a fixed
zone on `127.0.0.1:5353`, which would make `dig` fully verifiable. Same class of work as the HTTP
mock, and it unlocks the whole DNS group.

### §11.4. What verifies *especially* well

Worth saying, because it should influence ordering. Perl one-liners (§8), the scripting course
(§7), text-processing commands (§4.4) and comparison demonstrations (§10.1) are all
self-contained transformations of fixture text: no system state, no clock, no network, no
ownership. They replay exactly, first time, at near-zero harness cost. Lessons 7 and 8 needed two
fixture files between them and 25 checked outputs, which is the going rate for this class.

The apt and dpkg pages (§4.1) sit in the middle: fully verifiable, but they mutate system state,
so each needs its setup script to normalise `/etc/apt/sources.list.d` and `preferences.d` the way
`third-party-repositories` and `release-channels` already do, or a batch run will leak state
between pages. That trap has already bitten once.

### §11.5. Existing gaps

Every page has a setup script and `unreplayedProsePages` is zero, so nothing on the site has
outputs that nothing re-runs.

Two things to know when reading §2. A page whose every block is exempt counts in neither the
replayed nor the unreplayed figure: it opted in, the replay runs it, and it reports its
exemptions. And **a prose page with a setup script and zero (command, output) pairs reports `0/0`
and passes.** No page is in that state, which is why it has not bitten, but nothing stops one
arriving. Worth making a defect before the prose categories grow further.

## §12. Sequencing

Eight waves. Each is a coherent batch, each ships something a reader would notice, and the order
is demand-first with verification cost as the tiebreak.

**They have not been run in order**, and the table below is a set of open fronts rather than a
queue. That is not a complaint about the choices; it is how to read what follows.

| Wave | Status | What remains |
|---|---|---|
| 1. Namesake gap | **done** 2026-08-26 | Nothing |
| 2. Scripting 7–14 | **done** 2026-08-29 | Nothing |
| 3. Concepts | **done** 2026-08-27 | Nothing |
| 4. Perl track | **blocked** | The §10.4 `order:` change first, then 9 pages |
| 5. Processes and everyday files | **done** 2026-09-05 | Nothing; the combined `stat`/`file`/`basename` entry is all that is left of §4.3 |
| 6. Comparisons | **5 of ~20** | Nine writeable now, six waiting on a page under them: §10.1 splits them |
| 7. Recipes | **4 P1 done** 2026-08-29 | The §9 P2 list |
| 8. Networking and disk | **3 pages** | `du`, `df` and `ss` are written; everything else waits on a resolver fixture and a loop device |

**Wave 2: the scripting course (§7). Finished 2026-08-29.** Fourteen lessons, roughly 45% of the
top-100 bash questions, and the "course that stops halfway" problem is gone. The verification cost
was as low as §11.4 predicted: 36 checked outputs across the last six lessons, seven fixture files
between them, and no packages, services or accounts to stand up.

The lessons compounded rather than added. Each one after the eighth could assume the ones before
it, so the capstone is a working tool that explains nothing twice and links back for the rest,
and lesson 13 could treat `${var:?}` as known rather than teaching it alongside `set -u`. Writing
a course out of order would have cost more than it saved.

**Wave 4: the Perl track (§8).** Blocked on the §10.4 `order:` generalisation.

**Wave 5: processes, and the files everyone uses (§4.2, §4.3). Closed 2026-09-05.** Writing
`processes-and-signals` before `kill` and job control was the order §5's scope table argued for,
and it paid: both command pages could name a signal and link for the semantics rather than
teaching them again, and both came out standard rather than flagship because of it. The file half
closed five days later with `ln`, `mkdir`, `touch`, `cd` and `which`, four of them replaying
against the `mk_site_tree` that `cp`, `mv` and `rm` already share, which is what made a five-page
batch cost about what one page's fixture usually does. What remains of §4.3 is the combined
`stat`/`file`/`basename`/`dirname` entry, which `COMMAND_GROUPS` reserves `inspect-files` for.

**Wave 6: comparisons (§10.1). The largest open front, and now unblocked.** The first four written
are all package management, where the command pages landed first; the fifth came out of splitting
`which`. §12 used to say the shell and process comparisons wanted Waves 2 and 5 under them, and
both are closed, so §10.1 now lists nine candidates with every page beneath them written. Three of
those nine were unblocked by a single week: `ln`, `ss` and `sudo`.

**Wave 7: recipes (§9), interleaved.** All four P1 recipes shipped 2026-08-29. Interleaving is
still the right approach: each one was cheap, and three of the four were written against fixtures
and pages that already existed, which is what the wave was waiting for rather than any decision.
The P2 list is where the remaining demand is, led by saving a terminal session (+1448) and
freeing disk space when the root filesystem is full (+838), which ties four written pages
together.

**Wave 8: networking and disk (§4.6, §4.7).** Deliberately last: §11.2 and §11.3 mean it starts
with harness work, a local resolver fixture and a loop-device setup, before any page can be
written honestly. Three pages escaped that. `du` and `df` were pulled out of it for needing no
loop device, and `ss` turned out to need no peer either, because a fixture can stand up its own
listeners and the page is about what is listening rather than about reaching anything.

Running alongside: the tag-coverage problem in §1.1 (`performance` at zero, `archives` at one)
and the `0/0` reporting hole in §11.5.

### Scale, honestly

The backlog above is roughly 48 command pages, 14 concepts, 20 Debian articles, 9 Perl pages,
20 recipes, 15 comparisons and 8–15 troubleshooting pages: **something like 147 pages against the
93 that exist.** At this site's verification standard that is a very large amount of sandbox work,
and the plan should not pretend otherwise.

The measured rate is 19 pages in six days (2026-08-18 to 08-24), 21 in five (08-24 to 08-29), and
8 in the five after that. The last figure is the useful one, because it is what a week looks like
when the harness needs a decision: §2 says where those days went. Sustained at any of the three,
the backlog is the better part of a year, and it will not be sustained. The waves are ordered so
that stopping after any one of them leaves the site coherent rather than half-built, which only
holds if a wave is finished before the next one starts. Waves 1, 2, 3 and 5 are closed and Wave 7
has cleared its P1 line, so far without leaving a stub behind.

## §13. Shipped

What went out, and what writing it taught that the next batch would otherwise learn again.

- **2026-08-14**: Batch A, the text-processing toolkit: `sort`, `uniq`, `cut`, `tr`, `wc`,
  `diff`, `head`(+`tail`). 213 examples, cross-linked and backfilled into the pages that already
  leaned on them.
- **2026-08-15**: The replay harness, and `fixtures:` blocks checked as well as outputs. The
  first run found 15 fixture blocks that were hand-written summaries rather than reproducible
  output.
- **2026-08-17**: Batch F: `systemctl` and `journalctl`, both needing the systemd sandbox
  (`# verify: --systemd`).
- **2026-08-17/18**: The Debian category opened: `systemd-services`,
  `third-party-repositories`, `release-channels`. Cross-page apt state leakage found and fixed
  during the batch.
- **2026-08-18**: Scripting lessons 4–6 (`loops`, `script-arguments`, `functions`), and the
  three existing lessons retrofitted with fixtures: 14/14 first time.
- **2026-08-18**: Prose replay (`scripts/replay/prose-page.ts`), and `apt-essentials` fixed: it
  had four broken output blocks out of four, two silently abridged and two drifted two point
  releases.
- **2026-08-18**: The link audit (`scripts/gates/link-audit.ts`), which is the second demand signal
  §3.1 now says to run before choosing a batch.
- **2026-08-18**: All three concept pages verified. `pipes-and-redirection` had documented no
  output at all and now makes four checked claims, including both orderings of `2>&1`.
- **2026-08-18**: Wave 1 opened, and with it two new categories. `apt` and `dpkg` as command
  pages; `troubleshooting` created and filled with all four §6.1 P1 error pages
  (`packages-kept-back`, `could-not-get-lock-dpkg-frontend`, `sudo-command-not-found`,
  `repository-is-not-signed`); `compare` created with `apt-vs-apt-get`. The §10.1 and §10.2
  proposals went from open questions to seven pages.
- **2026-08-19**: `jq` and `tee`. `tee` closes a link the pipes concept page had been making to
  a page that did not exist.
- **2026-08-20**: Three more comparisons: `cron-vs-systemd-timers`,
  `remove-vs-purge-vs-autoremove`, `sh-vs-bash-vs-dash`. Plus `cowsay`, which is not on any
  backlog in this document and was written for its own sake.
- **2026-08-21 to 08-23**: The voice work, which produced no pages but changed how they are
  written: `.claude/reference/voice.md` as a standing reference covering pages, captions, code
  comments, ADRs and commit messages, and `scripts/gates/voice-check.ts` checking the lexical half of
  it, wired to a PostToolUse hook.
- **2026-08-23**: `xargs` (flagship) and the `environment-variables-and-path` concept page, the
  page §5 had rated the highest-value unwritten one on the site. The concept page's replay found
  the `$HOME` rule now recorded in the page-writing skill.
- **2026-08-23**: `head` and `tail` split into a page each, so no command page documents two
  commands.
- **2026-08-23**: `ls` (flagship), built around the terminal-versus-pipe distinction. Its
  fixture tree was extracted from `find.sh` into `mk_projects` in `_common.sh` so the two pages
  document one tree rather than two that resemble each other.
- **2026-08-24**: `ps`, opening §4.2. Its first replay found that the harness's own invocation
  is visible to any example that lists every process, and CI then found that the devcontainer
  boots six virtual consoles where a GitHub runner boots five, so seven examples were counting
  `agetty`. Both classes are now avoided rather than captured. The `agetty` fix was proved by
  stopping two gettys and replaying against the smaller count.
- **2026-08-24**: `du`, opening §4.6, and the `find-the-largest-files` recipe moved onto
  `mk_projects`. The recipe had been building its own `projects/` tree with different files and
  sizes, so the site showed two trees under one name; the shared one now backs both, and the
  recipe's ranking was recaptured against it.
- **2026-08-26**: Wave 1 closed. `apt-cache` and `apt-file` as command pages, and the three
  remaining §6.2 articles: `list-installed-packages`, `install-a-deb-file` and
  `which-package-provides-a-file`. §11.1 narrowed as a result, because `apt-cache`'s fixture
  repository declares `Architectures=all` and a version table can be published against it.
- **2026-08-27**: Wave 3 closed with `processes-and-signals` and `terminal-shell-and-tty`. The
  second found that `script -qec` gives a block a pseudo-terminal on purpose, so a page can show
  the same command answering differently either side of that line; the first found that a
  background process in an example inherits the harness's stdout and holds the whole batch open,
  which took one replay from nine seconds to five minutes while reporting 10/10 throughout.
- **2026-08-28**: The file basics, six pages: `cat`, `cp`, `mv`, `rm`, `less` and `chown`. The
  four that touch files share one `mk_site_tree` in `_common.sh`. `cat` was on no backlog in this
  document and was found by the link audit; `less` needed the shape decision recorded in §4.8;
  `rm` documents a `rm -r link/` that empties a directory and then reports that it could not.

  `test/replayTimings.test.ts` was re-thought in the same branch rather than nudged. It allowed
  three untimed pages and named `npm run replay -- --record-timings` as the remedy, both of which
  predate ADR-0023: nothing local records timings now, so a branch adding four pages failed a
  gate only a merge to main could clear. The budget measures pages per push instead.
- **2026-08-29**: Wave 2 opened, with scripting lessons 7 and 8, `arrays` and
  `parameter-expansion`. 25 checked outputs between them and two fixture files, which is what §7
  meant by near-zero verification cost. Two claims changed under the replay rather than being
  taken on trust: `wc` pads its counts into a column sized from the largest file it was given, and
  the trims are not `basename` and `dirname`, differing on a path with no slash and on one with a
  trailing slash.

  They went in as a pair because each is half of the other's answer: `"${arr[@]}"` is the
  positional-parameter rule from lesson 5 written out, and a trim applied to `"${paths[@]}"` runs
  on every element.
- **2026-08-29**: Wave 2 closed, with the last six lessons: `where-a-script-lives`, `arithmetic`,
  `here-docs`, `traps-and-cleanup`, `debugging-and-robustness` and the `a-real-script` capstone.
  36 checked outputs across six setup scripts, three of which create no files at all, and four of
  the six reproduced on the first replay.

  Three things came out of it worth keeping. The capstone publishes its own source with
  `cat backup.sh`, which makes the listing a reader reads a checked block rather than a copy that
  can drift from the file that ran; any future page publishing a script should do the same. A
  page about where a script lives cannot print `$PWD`, because that is the harness's working
  directory, so its fixture builds a tree at an absolute path of its own under `/srv`. And the
  `Terminated` line a shell prints when its child dies to a signal does not appear under the
  replay, which caught a documented output that had been captured from an interactive shell.
- **2026-08-29**: Wave 7's P1 line, four recipes: `add-a-directory-to-path`,
  `find-and-replace-across-files`, `find-permission-denied` and
  `keep-a-program-running-after-logout`. 16 checked outputs, and the category had gained nothing
  since 2026-08-18.

  Two of the four turn out to have a Debian-specific answer that the general one gets wrong.
  Debian's stock `~/.profile` already tests for `~/bin` and `~/.local/bin`, so the usual advice to
  edit a dotfile is unnecessary for the common case; and `tmux` is not installed on a base system,
  which is worth saying on a page that recommends it first.

  A third replayed green while proving nothing, and was rewritten. The example meant to show a
  non-login shell skipping `~/.profile` ran after the restore had removed the tool it was looking
  for, so "not on PATH" was true for the wrong reason. Any example whose claim is that something
  is *absent* has to create it first.
- **2026-08-30**: Wave 5 closed, with `kill` and `job-control`. 85 checked outputs across two
  setup scripts, and the process group now answers what a reader can do to a running program
  rather than only how to look at one.

  Both pages needed the systemd sandbox, for the same reason and one neither page is about: they
  kill things and then count what is left, and the default sandbox's PID 1 is the `sleep` holding
  the container open, which reaps nothing. Every killed process stayed in the table as a zombie
  carrying its own name, so the counts climbed with the number of examples that had already run.
  Any page that ends a process and then counts wants `# verify: --systemd`.

  Three traps came out of the harness rather than out of Debian, and the next page in this
  territory will meet them again. A background job inherits the example's stdout and holds that
  pipe open until it exits, so `sleep 300 &` with no redirect stops the replay dead for five
  minutes; a pipeline needs the redirect on its first stage too. `pkill -f` matches the
  `bash -c <code>` the harness wraps every example in, because that command line contains the
  pattern, so an unnarrowed `-f` example would signal the harness rather than the fixture.
  And bash prefixes an asynchronous job notice with `bash: line N:` when it is not interactive,
  which is not what a reader sees, so `Killed` and `deleting stopped job` notices had to be
  described rather than shown.

  A fourth trap got past the local replay and failed CI, which none of the others did. Reading a
  bitmap out of `/proc` prints bits the page is not documenting: `SigIgn` for a background job is
  `...0006` here and `...200000006` on a runner, because bit 33 is a real-time signal the C
  library reserves and the two machines do not agree on it. The low bits carrying the lesson were
  identical, so the page looked right and was still unreproducible. §11.1's rule is about the
  architecture *string*; this is the same rule about a number. Masking to the standard signals
  cuts it where the boundary means something, so the page still shows the bitmap and the value it
  shows is stable. `compare: shape` would have passed and should not have been used: it reduces
  an all-digit run and a hex run containing a letter to different tokens, so it would hold only
  while every machine's reserved bits happened to spell digits.

  One documented claim was wrong and the replay caught it. A stopped process does not hold a
  pending `TERM` in general: a default action is applied by the kernel and needs nothing from the
  process, so a stopped `sleep` dies where a stopped program with a handler stays put until
  something sends `CONT`. Both halves are examples now, which cost the fixture a fourth process.
- **2026-08-31**: `sudo`, with `su` folded in. 31 checked outputs and one fixture block, and the
  first page chosen from the link graph rather than from a wave: `sudo` was named on twelve pages
  with nothing to link to, against four for the next candidate.

  A page about privilege has to run without it. Replayed as `user`, because as root every refusal
  it documents succeeds instead and `sudo whoami` answers a question nobody asked. The setup
  script still needs privilege of its own, which the sandbox image grants, and the rule it adds to
  give `-n` something to refuse has two constraints worth reusing: it must sort after the image's
  own `NOPASSWD: ALL`, since sudo reads `/etc/sudoers.d` in lexical order and the last match wins,
  and it must name a command no other example runs, or that example asks for a password and fails
  with sudo's askpass advice rather than the line the page documents.

  The working directory is the trap this page nearly shipped with. Half the point of `-i` is that
  it moves you to root's home, which means the contrast prints the directory you started in, and
  that is `/home/user/verify-sudo` under the replay. A reader has no such path. The fixture makes
  `/srv/app` and the examples `cd` there first, the same answer `where-a-script-lives` reached for
  `$PWD`.
- **2026-08-31**: `df`. 24 checked outputs, and the first page whose fixture mounts a filesystem.

  The obvious approach does not work. `df` with no arguments is what everyone types, and inside a
  container it reports `overlay` on the host's disk: 224G here, something else on a runner, under
  a filesystem name a reader will never see on their own machine. Declaring that `volatile` would
  have shipped a page whose one memorable fact was wrong.

  So the setup script mounts two `tmpfs` filesystems and the page measures those. Both `size=` and
  `nr_inodes=` are pinned, the second because a tmpfs left alone sizes its inode table from how
  much memory the machine has. Every figure the page prints is one the fixture chose, and `tmpfs`
  is a filesystem type a reader has several of, so nothing about the output is peculiar to a
  container. The bare `df -h` stays on the page as an example with no output block, since it is
  what people type and the page can say honestly that the answer is theirs rather than ours.

  `nr_inodes=32` is what turns the page's best section from an assertion into a demonstration:
  thirty-one files, then `No space left on device` from a filesystem that reports 0% used. The
  same fixture shows `du` and `df` disagreeing over a deleted file a process still holds open.

  Mounting needs CAP_SYS_ADMIN, so the page asks for `--systemd`. That flag is the only one
  granting `--privileged`, and a page wanting privilege has to ask for systemd it does not need.
  Worth splitting if a second page wants the same thing.
- **2026-09-02**: `ss` and `man`, the last two §4 P1 pages. 103 checked outputs between them, and
  each needed a setup script that asserts a state rather than building a tree: `ss` because a
  container listens on nothing, `man` because the section 3 example has to *fail* and Debian ships
  that section in a package the image does not have.

  Two rules came out of them. A fixture that starts processes should test for the sockets or files
  those processes provide, not for the processes, so an example that closes one is repaired on the
  next restore rather than on the next full run; guarded that way `ss` costs 13ms per restore
  against 342ms cold. And a listener a page names must be executed directly rather than through
  `env`, because a process is named after the file the kernel was told to run: with `env` in the
  way, `ss -p` reports every service as `python3` and the page can say nothing about which one
  holds which port.
- **2026-09-02**: `unordered:`, and ADR-0026 with it. The `ss` page prints two listening sockets
  in an order the kernel settles per network namespace, six fresh containers here splitting three
  each way, so the page had an even chance of passing wherever it ran and no fixture could pin it.
  An example may now declare that the order of its lines is not part of its claim, and the lines
  are compared as a multiset.

  The finding worth keeping is what it replaced. `compare: shape` would have gone green on those
  examples and was already doing so on two of them, because `shapeOf` masks digit runs and reduces
  `0.0.0.0:8080` and `127.0.0.1:5432` to the same token: a comparison any two listening rows
  satisfy. A page reaching for `shape` to fix an ordering problem is trading a real check for one
  that cannot fail, and the audit that followed found every other `| sort` on the site was doing
  real work except two on `ps`, which turned out to be deterministic and now checks its rows in
  order.
- **2026-09-05**: five command pages and a comparison in one batch: `mkdir`, `touch`, `ln`, `cd`,
  `which` and `compare/which-vs-type-vs-command`. 122 checked outputs, and the batch cost about
  what one page's fixture usually does, because four of the six replay against the `mk_site_tree`
  that `cp`, `mv` and `rm` already share and the other two declare no sample data at all. **That is
  the argument for choosing a batch by fixture rather than by subject**, and it is the second time
  it has paid.

  Each page is built around a mistake rather than a flag list, and the four are worth having
  written down because they are what the pages are for: `mkdir -p -m 700 outer/inner` leaves
  `outer` at the umask default; `touch -d` moves the modification time back while the change time
  jumps to now; a relative `ln -s` target is read from the directory holding the link; and `ln -sf`
  on an existing symlink to a directory creates the new link inside it.

  The `which` page was split after it was written, which is the general finding. Twenty-four
  examples, of which six led with `which`: the page had become a comparison wearing a command
  page's shape. §10.1's category existed for exactly that, so the limit and the alternatives moved
  there. **A command page whose examples keep reaching for other commands is a comparison page**,
  and noticing it before the replay is cheaper than after.

  Two constraints on what a page may print came out of the batch and are now enforced rather than
  remembered. `ls -l` switches from a time of day to a year at about six months, so a timestamp
  goes through `ls` only where the moment is always recent or the date has already settled, and
  through `stat` otherwise; ADR-0027 and `test/timestampDrift.test.ts` hold the fixture dates clear
  of that boundary. And the replay names its working directory after the page, so no example may
  print `pwd` from it, which `cd` met in the form `where-a-script-lives` and `sudo` had each met
  separately.
