# Content plan

Working roadmap for what to write on debian.tips, and why. Not a spec: `src/content/schema.ts`
and `.claude/skills/write-content-page/SKILL.md` are authoritative on structure, tiering and
verification; this file is about *what* to cover and in *what order*.

Rewritten and substantially expanded 2026-08-18, when the verification harness reached every
page and the question became what to point it at next. The previous version's backlogs are
carried forward; §3 is new and reorders most of them.

Inventory refreshed 2026-08-24. §2, §11.5, §12 and §13 were a week out of date and are now
counted from the tree rather than remembered; the backlogs in §4 to §9 gained shipped markers.
Nothing in §3 was re-sampled, so the vote counts throughout are still the 2026-08-18 figures.

## §1. How this document works

Each backlog is roughly ordered by priority within itself. When a page ships, move it to §13 so
this file stays a live map rather than a wishlist. Batches are suggested groupings for parallel
`write-content-page` runs, not a rigid execution order.

### §1.1. Tag registry policy

`content/tags.yaml` is curated, not freeform. Before adding a tag: check whether an existing one
covers it; require at least two pages that will plausibly use it; prefer nouns for subject tags
and adjectives for audience tags. Add it in the batch that needs it, not speculatively.

Current usage is lopsided and worth watching. Recounted 2026-08-24 from page frontmatter:
`performance` still has **zero** pages, and `archives` has one. `cron`, `disk`, `environment`,
`search` and `ssh` have two. A tag with one page is a dead end for a reader who clicks it. Either
the backlog below fills them or they should be retired.

`disk` was the worst of these until `du` was written; `df` (§4.6) takes it to three, which is the
cheapest remaining fix and an argument for pulling that page forward out of Wave 8. `performance`
has no page in prospect anywhere in this document, so it is the one genuinely facing retirement
rather than filling.

### §1.2. Verification is part of the page, not polish afterwards

Every new page ends at N/N on `npm run replay -- <slug>`. Command pages declare `fixtures:` and
mirror them in `scripts/fixtures/<slug>.sh`; prose pages opt in by having that setup script at
all. Budget for it the way you budget for writing the examples, because it is the only check that
the outputs are true. `npm run check` validates shape rather than truth.

§11 is new and belongs to this policy: it lists the content that **cannot** be verified here, so
a batch doesn't discover it halfway through.

## §2. Where the site is now

Counted 2026-08-24 by `verificationStats` in `src/content/verificationStats.ts`, which is the
same routine the about page renders from, so these figures are the ones the site itself publishes
rather than a second tally that can drift from them.

**56 pages. 1,218 documented outputs, of which 1,201 are re-run on every push** and 17 are
exempted in a `.skip` file that names how each was verified instead. 1,300 examples across 29
command pages, 98 blocks of sample data, and 53 outputs declared `volatile:` and compared by
shape.

**Every page replays.** `unreplayedCommandPages` and `unreplayedProsePages` are both zero: there
is no page left whose outputs nothing re-runs. That closes the largest item in §11.5.

| Category | Pages | State |
|---|---|---|
| `commands` | apt, awk, chmod, cowsay, crontab, curl, cut, diff, dpkg, du, find, grep, head, journalctl, jq, ls, ps, sed, sort, ssh, systemctl, tail, tar, tee, tr, uniq, wc, wget, xargs | 29 pages, all replayed. Text processing is now complete enough to stop being the priority. Debian package tooling opened with `apt` and `dpkg`. `ps` and `du` open the process and disk groups at one page each. **Still no network-diagnostic or user-management coverage.** |
| `concepts` | environment-variables-and-path, exit-codes-and-error-handling, file-permissions-explained, pipes-and-redirection | 4 pages. Still the thinnest category relative to demand: §3.1 rates this layer above any command page. |
| `scripting` | your-first-script, variables-and-quoting, conditionals-and-test, loops, script-arguments, functions | Unchanged. Lessons 1–6 of a course that should run to ~13, stopping one lesson before the highest-demand topics. |
| `recipes` | bulk-rename-files, copy-files-between-machines, find-the-largest-files, kill-whatever-is-using-a-port, monitor-a-log-in-real-time | 5 pages, unchanged in count but **all five now replay**, which they did not on 2026-08-18. |
| `debian` | apt-essentials, systemd-services, third-party-repositories, release-channels | 4 pages, unchanged. Bounded by §10.0.1 to the explainer shape, which is why the week's Debian work landed in the two categories below instead. |
| `troubleshooting` | could-not-get-lock-dpkg-frontend, packages-kept-back, repository-is-not-signed, sudo-command-not-found | **New since the last revision.** §10.2 was a proposal; the category exists and holds all four of §6.1's P1 pages. |
| `compare` | apt-vs-apt-get, cron-vs-systemd-timers, remove-vs-purge-vs-autoremove, sh-vs-bash-vs-dash | **New since the last revision.** §10.1 was a proposal; the category exists with 4 of its ~19 candidates written. |

## §3. What the evidence says

Sampled 2026-08-18 from the Stack Exchange API (top-voted questions, all time) on
`unix.stackexchange.com` and `askubuntu.com`, and from a published tally of the top 100
Stack Overflow `bash` questions. Three findings, each of which changes the plan.

### §3.1. Demand is not shaped like a command reference

Of the top 100 Stack Overflow bash questions by votes, roughly **45 are script mechanics**:
quoting, arrays, string manipulation, argument handling, conditionals, functions, parameter
expansion. Another ~8 are stream redirection and ~7 are `PATH` and shell startup files. Fewer
than 15 are "how do I use command X".

The site has 19 command pages against 3 concepts and 6 lessons. That ratio is upside down
relative to what people actually ask. **Finishing the scripting course and thickening concepts
addresses more real demand than the next twenty command pages would.**

The single most-upvoted bash question of all time (+4324) is "get the source directory of a Bash
script from within the script itself", which is a lesson-9 topic rather than a command page.

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
| 2749 | How to list all installed packages | no |
| 1779 | "The following packages have been kept back": why, and how do I fix it | no |
| 1581 | How do I install a `.deb` file from the command line | no |
| 1175 | Unable to lock `/var/lib/dpkg/`, another process is using it | no |
| 1125 | How to upgrade a single package | no |
| 860 | Difference between `apt` and `apt-get` | partial |
| 819 | How do I find the package that provides a file | no |
| 781 | Correct way to completely remove an application | no |
| 772 | How do I remove old kernels | no |
| 716 | What does `apt-get update` actually do | partial |

Plus, from unix.SE: `resolv.conf` being overwritten (+369), "no public key available" on
`apt-get update` (+180), `-bash: sudo: command not found` (+176), adding a repository from the
shell (+166), listing packages by install date (+143), `gpg: keyserver receive failed: no
dirmngr` (+140), `/usr/lib/systemd/system` vs `/etc/systemd/system` (+133), "the repository does
not have a Release file" (+119), which Debian version am I running (+126).

**There is not one command page for `apt`, `dpkg`, `apt-cache` or `apt-file`**, and the four
Debian articles cover the conceptual layer without covering any of the errors above. This is the
highest-leverage gap on the site by a wide margin, and it is the one nobody else covers as well
because most of the internet writes it for Ubuntu.

`-bash: sudo: command not found` deserves special mention: it is *the* Debian newcomer
experience, caused by Debian's installer not adding you to the `sudo` group when you set a root
password, and it is pure Debian: Ubuntu users never see it.

## §4. Command pages

29 written. Below is the full candidate set, grouped as `COMMAND_GROUPS` in `src/config.ts`
groups them, with a priority marker and the reason each earns a page. Adding a slug to
`COMMAND_GROUPS` is part of shipping it, or it falls into "More commands".

**P1** = next two waves. **P2** = clear value, no urgency. **P3** = write if the surrounding
cluster gets written; not worth a page alone.

### §4.1. Debian package tooling

The §3.3 gap, and the group that has moved most since the last revision.

- **SHIPPED 2026-08-18 `apt`** (flagship): install/remove/update/upgrade/search/show,
  `full-upgrade` vs `upgrade`, why `apt` and not `apt-get` interactively.
- **SHIPPED 2026-08-18 `dpkg`** (flagship): the "dpkg is the layer below apt" framing,
  `--configure -a` after a broken install. Note §11.1: no `dpkg -l` table, because of the
  architecture column.
- **SHIPPED 2026-08-26 `apt-cache`** (standard): `policy`, `show`, `depends`/`rdepends`,
  `search`, `pkgnames`, `stats`. Its fixture stands up a second repository at `file:/srv/vendor`
  declaring `Architectures=all`, which is what lets a version table be published at all: the
  index a version was read from is named `all` rather than the machine's architecture. §11.1 is
  narrower than it was as a result.
- **P1 `apt-file`** (light): which package provides a file you don't have yet (the `dpkg -S`
  counterpart for uninstalled packages). +819 votes says this is a page.
- **P2 `update-alternatives`** (standard): default editor, `python`, `java`; the mechanism
  behind "how do I change the default X" questions.
- **P2 `dpkg-reconfigure`** (light): locales, timezone, keyboard. Debian-specific and nowhere
  else.
- **P2 `apt-mark`** (light): hold/unhold, auto/manual, the `autoremove` safety story.
- **P3 `aptitude`** (light): mostly to answer "should I use this" honestly: no.
- **P3 `debsums`, `deborphan`, `debootstrap`**: niche; `debootstrap` is interesting for a
  container/chroot article rather than a command page.

### §4.2. Processes, signals & job control

`ps` is written; the rest is not. `kill-whatever-is-using-a-port` still uses `kill` and `lsof`
with no page to link to.

- **P1 `ps`** (standard): **written 2026-08-24.** `aux` vs `-ef`, `-o` custom format, the
  BSD/UNIX syntax confusion, and `pgrep`/`pidof` folded in as planned. It needs the systemd
  sandbox, and its examples have to avoid enumerating the whole process table: the harness runs
  each one through `timeout … bash -c … | head`, all of which a whole-table listing would show.
- **P1 `kill` / `pkill` / `killall`** (standard): signals by name and number, why `-9` is a last
  resort, "what if kill -9 doesn't work" (uninterruptible sleep) which is +656 on unix.SE.
- **P1 `jobs` / `fg` / `bg` / `nohup` / `disown`** (standard): the +813 question is exactly this
  page. Ctrl-Z, `&`, and what survives logout.
- **P2 `top`** (standard): reading load average, sort keys, renice in place; `htop` in a callout.
- **P2 `lsof`** (standard): open files, `-i` for sockets, deleted-but-held files eating a disk.
- **P2 `timeout` / `time` / `watch` / `sleep`** (light, combined): "run this every N seconds"
  (+658) and "how long did this take" (+751).
- **P2 `free` / `uptime` / `nice` / `renice`** (light, combined): too small alone.
- **P3 `strace`** (standard): powerful, hard to verify deterministically (§11).
- **P3 `pidof` / `pgrep`**: folded into the `ps` page; the `kill` page should do the same.

### §4.3. Files & directories

The everyday commands, none of which have pages. Low glamour, high traffic.

- **SHIPPED 2026-08-23 `ls`** (flagship, not standard as estimated): the long format column by
  column, hidden files, sorting, time styles, symlinks. Built around the terminal-versus-pipe
  rule, because every example is captured through a pipe and the columned form a reader sees at a
  prompt is therefore not what the page can show.
- **P1 `cp` / `mv`** (standard, combined): `-r -a -i -n -u`, trailing-slash semantics, the
  "copy contents of a folder" question (+1380) that trips everyone.
- **P1 `rm`** (standard): `-r -f -i`, `--one-file-system`, the `rm -rf $VAR/` disaster and how to
  not have it. `danger: true` throughout.
- **P2 `ln`** (standard): hard vs symbolic, why `ln -s` argument order confuses, dangling links.
- **P2 `stat` / `file` / `basename` / `dirname` / `realpath`** (standard, combined as "inspecting
  files and paths"): the last three are constant in scripts.
- **P2 `mkdir` / `touch` / `mktemp`** (light, combined): `-p`, and `mktemp` as the right answer
  to temp files in scripts.
- **P2 `tree`** (light): not installed by default; worth saying so.
- **P3 `shred`** (light): and the honest SSD caveat, which is really a recipe.
- **P3 `install`** (light): the underused mkdir+cp+chmod+chown in one.

### §4.4. Text processing: filling out a strong group

- **SHIPPED 2026-08-23 `xargs`** (flagship): `-I{}`, `-0` with `find -print0`, `-P` for
  parallelism, why bare `xargs` breaks on spaces.
- **SHIPPED 2026-08-19 `tee`** (light): the link target the pipes concept page had been
  referencing with nowhere to point.
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

- **P1 `sudo` / `su`** (standard, combined): `sudo -i` vs `su -`, `visudo`, and the Debian
  "sudo: command not found" trap (§3.3). High Debian specificity.
- **P1 `chown` / `chgrp`** (standard): the direct companion to the written `chmod` page.
- **P2 `adduser` / `useradd` / `usermod` / `deluser`** (standard, combined): including the
  Debian-specific "`adduser` is the one you want, `useradd` is the low-level one" (+90).
- **P2 `id` / `groups` / `who` / `w` / `last`** (light, combined): who am I, who else is here.
- **P2 `passwd` / `chage`** (light): changing, locking, expiring.
- **P3 `getfacl` / `setfacl`** (standard): POSIX ACLs, when the nine bits aren't enough.
- **P3 `chattr` / `lsattr`** (light): `+i` immutable, an occasional real answer.

### §4.6. Disk & storage

- **P1 `du`** (standard): **written 2026-08-24.** The prediction held: `mk_projects` in
  `scripts/fixtures/_common.sh` supplied the tree, the page needed no loop device, and it was
  pulled out of Wave 8 on that basis. Two additions beside the tree carry the material the
  existing fixtures could not: a sparse file, for allocation against length, and a hard-linked
  pair, for what `-l` counts twice.
- **P1 `df`** (light): `-h`, and `-i` inode exhaustion, which is the failure nobody expects.
  Same argument as `du`: no loop device required for the ordinary output. `du --inodes` is
  already on the `du` page, so this one inherits a reader who has met the idea.
- **P2 `mount` / `umount` / `lsblk` / `blkid`** (standard, combined): reading `/etc/fstab`,
  what a bind mount is (+620).
- **P2 `rsync`** (flagship): already referenced by `copy-files-between-machines` with no page.
  `-a -v -z --delete --dry-run`, over ssh, the trailing-slash rule.
- **P3 `dd`** (standard): with `status=progress` (+886 on askubuntu) and heavy `danger: true`.
- **P3 `fdisk` / `parted` / `mkfs` / `fsck`**: see §11; needs loop devices to verify.
- **P3 `ncdu`** (light): the friendly `du`; not installed by default.

### §4.7. Networking & diagnostics

Verification, rather than the writing, is the constraint here. See §11.3.

- **P1 `ss`** (standard): the `netstat` replacement; "finding the PID using a port" is +834 and
  we have a recipe that needs the page.
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

- **P1 `less` / `man` / `apropos`** (standard, combined as "reading things in the terminal"):
  what the man page section numbers mean (+775), searching inside `less`, `-S` for wide output.
  A page about how to use the documentation is a good page for a documentation site.
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

- **SHIPPED 2026-08-23 Environment variables, `PATH`, and shell startup files**: login vs
  non-login vs interactive, `.bashrc` vs `.bash_profile` vs `.profile`, why your `PATH` edit
  didn't take, why cron doesn't have your `PATH`. Its replay found the harness rule now recorded
  in the page skill: the sandbox workdir sits inside `$HOME`, so `~/.profile` adds `~/bin` to
  `PATH` whenever that directory exists and the setup script has to remove it.
- **P1 Terminal, shell, tty, console and session**: the +1638 question. Pulls in Ctrl-C vs
  Ctrl-Z vs Ctrl-D, why Ctrl-S freezes your terminal (+974), and what `$TERM` is for.
- **P1 Processes, signals and job control**: PIDs, parent/child, orphans and zombies, the signal
  table, what `&` actually does. Supports §4.2 and answers +813.
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

4 articles in `debian/`, unchanged since 2026-08-18, but this section no longer describes one
category. §10.0.1 bounds `debian/` to the explainer shape, so the error-driven layer below went
to `troubleshooting` and the "X vs Y" items went to `compare`. Counting the pages this section
actually produced: **4 in `debian/`, 4 in `troubleshooting/`, 2 in `compare/`.**

### §6.1. Error-driven: the four P1 pages are written

Each of these is a real error string people paste into a search box. **The §10.2 question is
settled: `troubleshooting` is a category and these live in it**, tagged `debian` and `apt`, per
the rule in §10.0.1.

**All four P1 pages shipped 2026-08-18.** The category went from proposal to four pages in one
batch, which is the single largest change since the last revision of this document.

- **SHIPPED "The following packages have been kept back"**: phased updates, new dependencies,
  and `apt full-upgrade`. +1779.
- **SHIPPED "Could not get lock /var/lib/dpkg/lock-frontend"**: who holds it, why
  (unattended-upgrades usually), and the safe versus the dangerous fix. +1175.
- **SHIPPED "sudo: command not found"**: the Debian install-time root-password path, and how to
  add yourself to the `sudo` group from a root shell. +176 and pure Debian.
- **SHIPPED "NO_PUBKEY" / repository is not signed**: signing keys, `signed-by`, and why the old
  `apt-key adv` advice on the internet is now wrong. +180.
- **P2 "The repository does not have a Release file"**: usually a codename that no longer exists,
  or a repo that never supported your suite. +119.
- **P2 "dpkg: error processing package (--configure)"** and recovering a half-configured system.
- **P2 "Unmet dependencies" / "broken packages"**: what apt is actually telling you.
- **P2 "No space left on device" when `df` says there is**: inodes, or a deleted file still held
  open. Pairs with `df -i` and `lsof`.

### §6.2. Package management, conceptual

Two of the five P1 items shipped as `compare` pages rather than articles, which is §10.0.1
working: both were "X vs Y" in shape, so they took the comparison template. The three that
remain are genuine articles, and they are what is left of Wave 1.

- **SHIPPED 2026-08-18 as `compare/apt-vs-apt-get`**: which layer does what. +281, +1218, +860.
- **SHIPPED 2026-08-26 as `debian/list-installed-packages`**: +2749 and +143. Leads on
  `dpkg-query -W -f`, since §11.1 turned out to block `dpkg -l` and `apt list --installed`
  unfiltered and nothing else; `apt-mark showmanual` for what was asked for; `/var/log/dpkg.log`
  and `/var/lib/dpkg/info/*.list` mtimes for when, with `zgrep` over rotated apt history.
- **P1 Installing a `.deb` by hand, safely**: `apt install ./file.deb` rather than `dpkg -i`,
  and why the dependency story differs. +1581 and +1218.
- **P1 Finding which package provides a file**: `dpkg -S` for installed, `apt-file` for not.
  +819. Pairs with the `apt-file` command page in §4.1; write them together.
- **SHIPPED 2026-08-20 as `compare/remove-vs-purge-vs-autoremove`**: config files left behind,
  and the `deb-systemd-helper` state that survives a remove. +781.
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

## §7. Scripting course: lessons 7–14

Lessons 1–6 shipped, and nothing has been added since 2026-08-18. §3.1 says this course covers
more real demand than anything else on the site, and it stops right before the topics that
generate the most questions.

7. **Arrays**: indexed and associative, `"${arr[@]}"` vs `"${arr[*]}"`, appending, the quoting
   pitfalls that are worse than for scalars. +1202, +646, +507, +455.
8. **Parameter expansion and string manipulation**: `${var#pre}`, `${var%suf}`, `${var/a/b}`,
   `${var:-default}`, `${#var}`, case conversion. Answers +1030, +1801, +1692, +592, +579, +513,
   +759, the densest single lesson on the list.
9. **Paths, and where a script lives**: `$0`, `BASH_SOURCE`, `dirname`/`realpath`, and the
   +4324 question. Small topic, biggest single question on Stack Overflow.
10. **Arithmetic and numeric comparison**: `$(( ))`, `-eq` vs `=`, integer-only reality,
    `bc`/`awk` for floats. +892, +460, +495.
11. **Here-docs, here-strings and generating files**: `<<`, `<<-`, `<<'EOF'` vs `<<EOF`,
    writing config from a script. +628, +482, +663.
12. **Traps, cleanup and signals**: `trap ... EXIT/INT/TERM`, the temp-file cleanup pattern,
    `mktemp`, and why `set -e` alone isn't enough.
13. **Debugging and robustness**: `set -x`, `set -euo pipefail` and its caveats, `shellcheck`,
    and reading an error message. Reuses the exit-codes concept page.
14. **Capstone: a real script**: a backup or log-rotation tool that uses arrays, arguments,
    functions, traps and exit codes, then gets scheduled with `crontab` or a systemd timer.

Two candidate additions, lower priority: **reading input safely** (`read -r`, `IFS`, the
`while read` loop, prompting for yes/no; +1245, +633, +503) may be big enough to split out of
lesson 4; and **subshells, `set -e` scope, and when a pipeline runs where**: subtle, but it is
the root cause of a whole class of "why didn't my variable survive the loop" confusion.

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

5 written, none added since 2026-08-18, though all five now replay. Recipes are the natural home
for the "how do I do X" half of §3, and each one is cheap. Ordered by demand.

- **P1 Add a directory to `PATH` permanently**: +1412 / +1001 / +724, and the answer differs for
  interactive shells, scripts, cron and systemd. Pairs with the §5 environment page.
- **P1 Find and replace across many files**: `grep -rl` + `sed -i`, with `find -print0`,
  a dry run first, and a backup. +956 / +982 / +588.
- **P1 Keep a program running after you log out**: `nohup`, `setsid`, `tmux`, and
  `systemd-run --user`, with an honest recommendation. +1044.
- **P1 Exclude "permission denied" noise from `find`**: `2>/dev/null` and why that is the wrong
  answer, `-readable`, running as the right user. +749, and a nice pipes/exit-codes callback.
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

Approved 2026-08-18: add the categories that make sense. §10.0 first, because it decides what
"makes sense" means and settles two questions the previous draft left open.

**Outcome, 2026-08-24.** Two of the three proposals were built (§10.1 `compare`, §10.2
`troubleshooting`), taking the site to seven content categories. §10.3's glossary was not
started, and §10.4's `order:` change was not made. §10.5's nav question is now live rather than
hypothetical, since seven categories is one short of the eight it was written for.

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

Applied to §6, this settles the open question there: the §6.1 error pages ("kept back", the dpkg
lock, `sudo: command not found`, `NO_PUBKEY`) are **`troubleshooting`**, tagged `debian` and
`apt`. `dpkg vs apt vs aptitude` is **`compare`**. `release-channels` and `systemd-services` stay
where they are. The rule keeps `debian` at a browsable dozen instead of a sprawl.

Three proposals follow, in order of confidence. **The first two were accepted and built; both
categories exist and hold four pages each.** §10.3 and §10.4 are still open.

### §10.1. `compare`, the "X vs Y" pages: **BUILT**

§3.2 established this as the most repeated question shape on unix.SE. The category now exists,
with the template as proposed: **what each one is → what actually differs → when to use which →
the honest verdict**, 400–800 words.

Written so far: `apt-vs-apt-get` (2026-08-18), then `cron-vs-systemd-timers`,
`remove-vs-purge-vs-autoremove` and `sh-vs-bash-vs-dash` (all 2026-08-20). Four of the ~19
candidates below.

Strong candidates, all sourced from real top questions: `apt` vs `apt-get` vs `aptitude` vs
`dpkg`; `terminal` vs `shell` vs `tty` vs `console`; `nohup` vs `disown` vs `&` vs `tmux`;
`[` vs `[[` vs `((` vs `test`; login vs non-login vs interactive shells; `/opt` vs `/usr/local`
vs `/usr/bin`; `sh` vs `bash` vs `dash` (and Debian's `/bin/sh` → `dash` decision, which is
Debian-specific and burns people); `cron` vs systemd timers; `rsync` vs `scp` vs `sftp`;
`ip` vs `ifconfig`; `ss` vs `netstat`; `su` vs `sudo -i` vs `sudo -s`; `remove` vs `purge` vs
`autoremove`; `apt upgrade` vs `full-upgrade` vs `dist-upgrade`; `grep` vs `egrep` vs `grep -E`;
`printf` vs `echo`; `>` vs `>>` vs `tee`; hard vs symbolic links; `useradd` vs `adduser`.

That is 19 pages of high-intent, low-competition content that also functions as an internal
linking hub: every comparison page naturally links to two or three command pages.

**Risk to manage:** a comparison page is mostly prose and easily becomes an unverifiable opinion
piece. The rule should be that each one carries at least one real demonstration of the difference,
which for most of the list is genuinely possible (`echo` vs `printf` on `\n`, `[` vs `[[` on an
unquoted empty variable, `remove` vs `purge` on a leftover conffile).

That rule held for the first four: each has a setup script and replays. Worth re-checking on
every new one, because it is the constraint that keeps a comparison page evidence rather than
opinion.

### §10.2. `troubleshooting`, pages named after the error: **BUILT**

§6.1 collected eight of these for apt alone, and §9 has several more. The distinguishing feature
is the *entry point*: a recipe is "I want to do X", troubleshooting is "X broke and here is the
message". People paste the error verbatim into a search box, so the page title should be the
error string.

Template: **the message → what it actually means → the check that tells you which cause you have
→ the fix for each → how to avoid it**.

This is arguably the highest-converting category on the whole plan, and it suits this site's
verification harness unusually well: an error message is a deterministic output. Reproducing
"could not get lock" in a sandbox is a genuine test that the page describes the real thing.

The open question was whether these live here or in `debian/`. **Resolved in favour of a
`troubleshooting` category**, because half the list (`no space left on device`, `permission
denied`, `command not found`, ssh key rejection) is not Debian-specific at all, and splitting
them by cause would put identical-looking pages in two places. Four pages exist; the §6.1 P2 list
is what remains.

The claim that an error message is a deterministic output held up: all four reproduce their error
in the sandbox rather than quoting it, which is the version of this category worth having.

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

   **Still not done, and it is the whole of what blocks Wave 4.** Checked 2026-08-24:
   `src/content/loader.ts` still special-cases the literal `"scripting"` in eight places, across
   the type definitions, the sort comparator, the duplicate-order check and the prev/next pass.
   Nothing else in the backlog needs this change, so it is Perl's entry fee and should be costed
   as part of that wave rather than treated as groundwork already laid.
2. **A `track:` field** (do *not* do this yet). Only needed to run two ordered courses inside one
   category, which nothing requires. If it ever lands, default `track` to the category name so no
   existing page changes.

This is the whole of the hierarchy the site needs. It is worth noticing that it is a sequence
problem rather than a taxonomy one, which is why it does not want a subcategory either.

### §10.5. Nav, once there are eight categories: **SETTLED by the 2026-08-23 redesign**

The trigger this section named (the seventh category having pages in it) arrived, and the
redesign answered it before this document was updated. `src/config.ts` now carries `NAV_GROUPS`
alongside `NAV_ORDER`, collapsing the seven categories into two nav items: **Commands**, and
**Guides** holding concepts, scripting, recipes, troubleshooting, compare and debian.

That is the grouping option from the list below, with a coarser split than the "Learn / Do /
Reference" one sketched here. Nothing further is needed when an eighth category lands, which
was the point of doing it this way: a new category joins a group rather than adding a nav item.

The original reasoning, kept because the decision rested on it: eight top-level nav items
is too many, but that is a navigation problem with a navigation fix, not a reason to reshape the
content model. `NAV_ORDER` exists as an editorial list deliberately free to differ from
`CATEGORIES`.

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

New section. Several attractive items above are blocked or constrained by the verification setup,
and knowing which *before* a batch starts is worth more than discovering it halfway through.

A constraint this section does not cover, because it is about *when* rather than *what*: the
harness verifies every page against one pinned Debian release, and says nothing about whether that
pin is still current or whether a page holds on any other release. `PLAN-DEBIAN-VERSIONS.md` has
the measurements and the options. The part that matters for content planning is that the pages
this plan prioritises (§4.1, §6.2, the whole apt and dpkg cluster) are the ones that differ most
between releases, so the version question grows with exactly the work the waves put first.

### §11.1. Architecture may never appear in output

`arm64` on the devcontainer, `amd64` on the CI runner, no emulation available locally: any block
printing an architecture fails in exactly one of the two places. ADR-0004 is the decision and
`test/architecture.test.ts` enforces it. What follows is the practical map, worked out while
writing the `apt-cache` and `list-installed-packages` pages, because an earlier revision of this
section said "no package tables" and that turned out to be both too broad and too narrow.

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
ownership. They replay exactly, first time, at near-zero harness cost. The three concept pages
verified on 2026-08-18 needed one small fixture each and passed on the first run.

The apt and dpkg pages (§4.1) sit in the middle: fully verifiable, but they mutate system state,
so each needs its setup script to normalise `/etc/apt/sources.list.d` and `preferences.d` the way
`third-party-repositories` and `release-channels` already do, or a batch run will leak state
between pages. That trap has already bitten once.

### §11.5. Existing gaps: **mostly closed**

The five unreplayed recipes are done. Every one now has a setup script, and
`unreplayedProsePages` is zero, so no page on the site has outputs that nothing re-runs. The
three fixable cases took a fixture and `# verify: --user` as predicted; the two genuine
exemptions (`monitor-a-log-in-real-time`, needing a concurrent writer) are recorded as
`<!-- verify: skip -->` with the reason inline.

One consequence worth knowing when reading §2: a page whose every block is exempt counts in
neither the replayed nor the unreplayed figure. It opted in, the replay runs it, and it reports
its exemptions. That is why 26 prose pages contribute output rather than 27.

Still open: **a prose page with a setup script and zero (command, output) pairs reports `0/0` and
passes.** No page is currently in that state, which is why it has not bitten, but nothing stops
one arriving. Worth making a defect before the prose categories grow further.

## §12. Sequencing

Eight waves. Each is a coherent batch, each ships something a reader would notice, and the order
is demand-first with verification cost as the tiebreak.

**How the waves have actually been run, as of 2026-08-24.** Not in order. The work has been
picked page by page across four waves at once, which is why no wave is finished and why the
sequencing below needs reading as a set of open fronts rather than a queue. That is not a
complaint about the choices: `ls` and `xargs` were both worth writing when they were written.
But the effect is that **Wave 1 sits at roughly three-quarters done and has been left there**.
The remaining quarter is `apt-file` and two articles, without which a reader
searching the apt cluster finds most of it and not the rest.

| Wave | Status | What remains |
|---|---|---|
| 1. Namesake gap | **~85%** | `apt-file`, and two §6.2 articles (install a `.deb`, which package provides a file) |
| 2. Scripting 7–14 | **untouched** | All eight lessons |
| 3. Concepts | **1 of 3** | terminal/shell/tty, processes-and-signals |
| 4. Perl track | **blocked** | The §10.4 `order:` change first, then 9 pages |
| 5. Processes and everyday files | **3 of 7** | `kill`, job control, `cp`/`mv`, `rm` |
| 6. Comparisons | **4 of ~19** | Everything not listed in §10.1 as written |
| 7. Recipes | **untouched** | All P1 recipes; the existing five were verified, not added to |
| 8. Networking and disk | **1 page** | `du` is written; `df` is the other page needing no harness work. Everything else waits on a resolver fixture and a loop device |

**Wave 1: the namesake gap (§4.1, §6.1, §6.2).** The §10.2 decision it was waiting on has been
taken, the `troubleshooting` category exists, and all four P1 error pages are written, as are
`apt` and `dpkg`. **Finishing this is the highest-value work left**, and it is five pages rather
than a wave: two command pages and three articles, all fully verifiable, all in the cluster the
site is named after.

**Wave 2: finish the scripting course (§7).** Lessons 7–14, untouched. Roughly 45% of the
top-100 bash questions, near-zero verification cost, and it removes the "course that stops
halfway" problem. On the evidence in §3.1 this outranks everything except finishing Wave 1, and
it has been passed over for a week in favour of command pages, which §3.1 explicitly rates lower.

**Wave 3: the environment and terminal concepts (§5).** The `PATH`/startup-files page shipped
2026-08-23. The terminal/shell/tty page and processes-and-signals remain. Worth noting that
processes-and-signals is the natural companion to `ps` and `kill` in Wave 5: writing those
command pages first repeats the situation `kill-whatever-is-using-a-port` was in, referencing
commands and concepts with nothing to link to.

**Wave 4: the Perl track (§8).** Still blocked on the §10.4 `order:` generalisation, which
has not been made. Everything else about the wave stands.

**Wave 5: processes, and the files everyone uses (§4.2, §4.3).** `ls` and `xargs` are done.
`ps`, `kill`, job control, `cp`/`mv` and `rm` remain, and `ps` is the next page after this
revision.

**Wave 6: comparisons (§10.1).** Four written, ahead of schedule relative to this plan, which
had them waiting for their underlying command pages. The four that exist are all package
management, where the command pages did land first; the shell and process comparisons still
want Waves 2, 3 and 5.

**Wave 7: recipes (§9), interleaved.** Still the right approach, still not started. The five
existing recipes were brought up to replaying during this period, which is a different job.

**Wave 8: networking and disk (§4.6, §4.7).** Deliberately last, because §11.2 and §11.3 mean
this wave starts with harness work (a local resolver fixture and a loop-device setup) before
any page can be written honestly. **`du` and `df` were the exception and were pulled out of this
wave.** `du` is written; `df` is the same argument and still open. See §4.6.

Running alongside: the tag-coverage problem in §1.1, now down to `performance` at zero and
`archives` at one, and the `0/0` reporting hole in §11.5. The five unreplayed recipes that used
to head this list are done.

### Scale, honestly

The backlog above is roughly 60 command pages, 14 concepts, 20 Debian articles, 8 more scripting
lessons, 9 Perl pages, 20 recipes, 19 comparisons and 8–15 troubleshooting pages: **something
like 170 pages against the 56 that exist.** At this site's verification standard that is a very
large amount of sandbox work, and the plan should not pretend otherwise. The waves are ordered so
that stopping after any one of them leaves the site coherent rather than half-built.

There is now a rate to measure it against: 19 pages in the six days between 2026-08-18 and
2026-08-24. Sustained, that is a year of work, and it will not be sustained. The point of the
waves is that stopping is survivable, which only holds if a wave is finished before the next one
starts. Wave 1 is the current counter-example.

## §13. Shipped

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
- **2026-08-18**: Prose replay (`scripts/replay-prose-page.ts`), and `apt-essentials` fixed: it
  had four broken output blocks out of four, two silently abridged and two drifted two point
  releases.
- **2026-08-18**: The link audit (`scripts/link-audit.ts`), and the repository-paths/constants
  refactor (`src/paths.ts`, `STANDALONE_PAGES`, derived `PROSE_CATEGORIES`).
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
  comments, ADRs and commit messages, and `scripts/voice-check.ts` checking the lexical half of
  it, wired to a PostToolUse hook.
- **2026-08-23**: `xargs` (flagship) and the `environment-variables-and-path` concept page, the
  page §5 had rated the highest-value unwritten one on the site. The concept page's replay found
  the `$HOME` rule now recorded in the page-writing skill.
- **2026-08-23**: `head` and `tail` split into a page each, so no command page documents two
  commands.
- **2026-08-23**: `ls` (flagship), built around the terminal-versus-pipe distinction. Its
  fixture tree was extracted from `find.sh` into `mk_projects` in `_common.sh` so the two pages
  document one tree rather than two that resemble each other.
- **2026-08-24**: This revision, and the promotion of this file and `PLAN-DEBIAN-VERSIONS.md` into
  `docs/plans/`. Also `scripts/voice-check.ts`: the hook checked any file the session wrote, while
  `npm run voice` walked a narrower corpus. The two entry points now share one definition of
  scope, so writing outside it no longer produces a wall of findings against prose the guide was
  never written for.
- **2026-08-24**: `ps`, opening §4.2. Its first replay found that the harness's own invocation
  is visible to any example that lists every process, and CI then found that the devcontainer
  boots six virtual consoles where a GitHub runner boots five, so seven examples were counting
  `agetty`. Both classes are now avoided rather than captured. The `agetty` fix was proved by
  stopping two gettys and replaying against the smaller count.
- **2026-08-24**: `du`, opening §4.6, and the `find-the-largest-files` recipe moved onto
  `mk_projects`. The recipe had been building its own `projects/` tree with different files and
  sizes, so the site showed two trees under one name; the shared one now backs both, and the
  recipe's ranking was recaptured against it.
