---
name: write-content-page
description: Author or extend one debian.tips content page (command reference, concept, scripting lesson, recipe, or Debian article) to the site's schema, tiering, and style-guide contract. Use when asked to write, draft, or expand a specific page, e.g. "write the sed page", "add examples for tar", "draft the exit-codes-and-error-handling concept", "write recipe: bulk-rename-files". Not for open-ended "what should we write next" planning.
---

# Write a debian.tips content page

One page per invocation. This checklist is self-contained: everything it references
(`src/content/schema.ts`, `content/tags.yaml`, existing content under `content/`) is committed to
the repo, so it works the same for anyone who clones it, not just this working copy. If this
project happens to keep its own internal planning notes locally, they're worth a skim for extra
prose detail, but nothing below depends on them existing.

## 1. Identify the page

From the request, work out:
- **category**: one of the values in `CATEGORIES` in `src/content/schema.ts`, whose comment
  gives the test for which one a page belongs in → target directory
- **slug** → directory/file name (command pages: `content/commands/<slug>/`; others:
  `content/<category>/<slug>.md`)
- **tier** (commands only: `flagship|standard|light`) drives length and example count. Judge it
  by comparing to existing pages in `content/commands/`: a big, commonly-reached-for command with
  real depth (grep, find, sed, curl) is flagship; an everyday command with modest scope (tar) is
  standard; a small single-purpose command is light.
- **one command per page, unless the commands are meaningless apart.** `jobs`/`fg`/`bg` are one
  page called job control, because none of the three is usable without the others. Commands that
  merely resemble each other get a page each: `head` and `tail` shared one for months, and the
  cost was that `tail` had no URL of its own, its `-f` and rotation material sat under
  `/commands/head/`, and every inbound link had to be titled "head and tail" to make sense. When
  a combined page is right, the primary command is the slug and title, and the others get their
  own `##` sections within it.

If the category, slug, or tier isn't obvious from the request or from comparable existing
content, stop and ask rather than guessing.

## 2. Check the schema, not just this checklist

Read `src/content/schema.ts`, which is authoritative if anything below has drifted out of sync with
it. Frontmatter needs `title`, `description` (50–160 chars), `tags` (1–6), `updated` (ISO date,
use today), `category`; command pages also need `tagline` (≤60 chars) and `tier`; scripting pages
need a unique `order`. `related` is optional but every slug in it must exist (or be created in
this same batch).

Check `content/tags.yaml` for the allowed tag set. Tags are curated on purpose, so if the page
genuinely needs a concept not in the registry, stop and ask before adding one; don't just add it
because a page reads better with it.

## 3. Match structure and length to page type

- **Commands**: `index.md` prose intro (flagship 600–1200 words / standard 150–400 / light
  50–150) + `examples.yaml` (flagship/standard 50–100 examples, light 25–50), sections ordered
  basic → advanced, `command:` field matching the directory name.
- **Concepts**: 800–2000 words: hook → mental model → worked examples → common misconceptions →
  "go deeper" links.
- **Scripting**: one concept, runnable script(s), a pitfalls callout, exercises with `<details>`
  answers; `order` drives prev/next.
- **Recipes**: 300–700 words, rigid **Problem → Solution → How it works → Variations**; one task
  per recipe.
- **Debian**: same shape as concepts, Debian-specific.

## 4. Test every example for real, and don't fabricate output

Run every example inside the disposable sandbox (`scripts/sandbox.sh`), not directly on the
devcontainer. It's a throwaway `debian:trixie` container (same "current Debian stable" target),
so installing packages, using `sudo`, or standing up a service (e.g. `sshd`) for a test leaves
nothing behind on the host:

- Start one sandbox per page: `scripts/sandbox.sh start` (prints a container name). Reuse that
  name for every `exec` call for this page so scratch fixtures and installed packages persist
  across steps, then `scripts/sandbox.sh stop <name>` once done.
- Run each command with `scripts/sandbox.sh exec <name> "<command>"` (add `-u user` for a
  non-root prompt) before writing its `output:` block. Copy real output, then sanitize
  hostnames/users to `deb1`/`user`.
- If a command genuinely can't be run even in the sandbox (touches real hardware, needs
  privileges Docker itself can't grant), say so explicitly in your reply instead of inventing
  plausible-looking output, and flag it for the user to verify on a real box.
- Destructive examples (`rm`, `dd`, `mkfs`, `chmod -R`, `curl | sh`, etc.) get `danger: true` and
  the description must state the failure mode. Prefer teaching the safe variant first.

### 4a. Rules that a replay pass has actually caught being broken

Every one of these came from real examples on this site that looked fine and weren't. They're
cheap to honour while writing and expensive to find later.

- **The command must produce the output exactly as printed.** Not a variant you ran, not the same
  command with an extra `| tail -n3`, not a different path. `grep -r "TODO" ~/projects` cannot
  print relative paths, because the shell expands `~` before grep sees it, so an example showing
  `projects/app/main.ts:…` is unreproducible no matter how plausible it reads.
- **Never abridge an `output:` block silently.** If the real output is 10 lines, show 10 or add a
  `| head -N` to the command so the shown output is complete for what's shown.
- **Commands that write to a file print nothing.** `sed -i`, `sort -o`, `crontab file` produce no
  stdout. Either omit `output:` or make the command show its result (`… && cat file`).
- **Make non-deterministic output deterministic.** awk array iteration order is unspecified (and
  differs between mawk and gawk); `find`, `grep -r` and glob expansion follow directory order,
  which is a hash order you cannot influence: four entries created `a,b,c,d` read back as
  `d,b,c,a`. Pipe through `sort`, or narrow the glob, rather than documenting whatever one run
  happened to print. Checksums count too: two fixture files with identical bytes produce identical
  `md5sum` output, which reads on the page as though the fixture were broken.
- **Don't let an example depend on the whole working directory.** `ls *.txt | wc -l` changes
  answer whenever a fixture is added. Target a stable subset.
- **Right-aligned output needs `output: |2`.** `wc` and `uniq -c` pad their columns. A plain `|`
  block takes its indentation from the first line, so any later line indented *less* is silently
  re-indented (or errors), quietly changing what the page claims the command prints. Use the
  explicit indicator and keep the real padding.
- **Anything an example writes to `~` outlives the example.** The restore before each one clears
  the harness's working directory, and that directory sits *inside* `$HOME`
  (`scripts/lib/sandbox.ts`), so `~/bin`, `~/.config` and `~/.bashrc` are all outside what gets
  reset. A page that writes to `~` contaminates its own later examples first and every page after
  it second: `~/bin` is the sharp case, because Debian's default `~/.profile` puts it on `PATH`
  whenever it exists, so creating it silently changes what any later `bash -l` prints. Prefer
  writing inside the working directory, and where the page's subject really is `$HOME`, have the
  setup script normalise it (`rm -rf "$HOME/bin"`) so every example starts from the same state.

### 4b. Declare the sample data, then prove it

Any example whose output can't be interpreted without seeing its input needs a `fixtures:` entry
and above all where output is a summary (`wc -l file` → `40`) rather than a transformation of the
input. Pages whose output echoes the input (`cut`, `head`) often need none.

- Add a top-level `fixtures:` list to `examples.yaml` (`name`, optional `note`, `content`). It
  renders as one collapsed block above the examples.
- Mirror it in a setup script at `scripts/fixtures/<command>.sh` that recreates those files.
  Comment each step with the rule it enforces: what the page's output depends on, and what
  breaks if the sandbox does not have it, never with the story of how it was found. CLAUDE.md's
  "Writing code here" has the shape; these scripts are linked from the page they belong to, so a
  reader meets them cold.
- **If the input is a directory rather than a file** (`find`, `tar`, `ls`, `du`), the fixture is a
  captured `ls -lAR` of the tree, since a reader can't evaluate `find projects -mtime +365` printing one
  path without seeing the other nine files and their dates. Capture it from the sandbox rather than
  writing it out: it encodes modes, sizes and mtimes at once, and all three must be set explicitly
  in the setup script. Don't rely on the umask for a mode you assert on: the umask a `docker exec`
  inherits belongs to the host, not to the image (0000 on this project's devcontainer, 0022 on a
  GitHub runner) and while the replay pins it to 0022, a plain `scripts/sandbox.sh exec` does
  not. The same command gives different modes depending on where and how you ran it.
- Then prove the two agree:

```sh
npm run replay -- <command>        # starts a sandbox, replays the page, stops it again
```

It replays every example against freshly restored fixtures and diffs the real result against the
page, then does the same for the `fixtures:` blocks. **Aim for N/N on both counts.** A fixture that
doesn't reproduce the documented output is worse than no fixture, because it looks like evidence.

A fixture block is read back with `cat <name>` unless it sets `from:`, the command that reproduces
it. Set `from:` whenever the block isn't one file's literal contents, and keep the block to
something a reader could actually produce rather than a hand-written summary:

| the block is | `from:` |
| --- | --- |
| a directory tree | `ls -lAR projects` |
| a long file, abridged | `head -3 report.txt; echo '…'; tail -1 report.txt` |
| control bytes made visible | `sed "s/\r/␍/" crlf.txt` |
| two files shown together | `tail -n +1 setA.txt setB.txt` |
| a duplicate of another fixture | `cmp -s users.csv users2.csv && echo '(same as users.csv)'` |

If an example's output is genuinely useful but can't reproduce byte for byte (`systemctl status`
with its PID and uptime, `df -h` on the reader's own disks) don't drop it and don't fake it. Add
`volatile:` with a note saying what will differ:

```yaml
- title: "Read a service's full status block"
  code: systemctl status cron --no-pager | head -9
  volatile: "the date, uptime, invocation id, PID and memory figures are specific to your machine"
  output: |2
    ● cron.service - Regular background program processing daemon
    ...
```

The note is shown to the reader above the output, and the replay checks that example by shape:
numbers, quantities, dates and identifiers are free to differ, everything else must match. It is
not an escape hatch: output containing something the reader could never see (a container id, a
path from the harness) still has to be removed rather than declared volatile.

For examples a batch genuinely can't replay *at all* (needing a concurrent writer, like `tail -f`,
or a network peer), list the title in `scripts/fixtures/<command>.skip` with a comment saying how it
*was* verified. Don't leave it silently failing, and don't delete the example. Titles are matched
exactly and must name an example that documents an `output:` block, and the harness rejects an entry
that matches nothing, because a renamed title otherwise leaves the file claiming an exemption it
no longer grants.

If a page's output depends on who ran the command (file ownership in `ls -l` or `tar -tvf`, a
path under `~`, a permission denial root would never see) put `# verify: --user` in its setup
script. Both `replay-command-page.ts` and `adopt-real-output.ts` read it, so the command above stays
right for every page. Without it, replaying `chmod` as root reports 9/42 on a page that is
perfectly correct, and that looks exactly like a page that has drifted.

Two helpers exist for repairs: `scripts/fix-output-whitespace.ts` (rewrites blocks whose only
problem is lost padding, and it refuses anything differing in substance) and
`scripts/adopt-real-output.ts` (replaces named examples' output with the real capture; use when
output was silently abridged).

### 4d. Prose pages: the same rules, in Markdown

A concept, lesson, recipe or Debian article states its claims as a ```` ```bash ```` fence
followed by a bare fence holding the output. Those pairs are replayed by
`scripts/replay-prose-page.ts` when the page has a `scripts/fixtures/<slug>.sh`, so write them to the
same standard as an `output:` block:

- **The output fence must open on the line immediately after the command fence closes.** Prose in
  between means the two are not paired, and the claim goes unchecked.
- **The whole command's output, not a slice of it.** `dpkg -l nano` prints a five-line header;
  three commands in one fence print three commands' worth. Add `| head -2` to the command, or
  split the fence, so what is shown is all of what the shown command prints.
- **Never print an architecture.** `arm64` locally, `amd64` in CI: a block containing either
  fails in one of the two. Prefer `dpkg -s pkg | head -2` over `dpkg -l pkg`, and
  `apt-cache policy pkg | head -3` over the full listing.
- Output that legitimately moves (a package version, a count of pending upgrades) gets
  `<!-- verify: shape why it moves -->` on the line above the command fence. Output that cannot
  be replayed at all gets `<!-- verify: skip the reason -->`, and the reason is required.
- A bare fence that is a config snippet rather than command output pairs with nothing and is
  reported as "not checkable". That is correct; just make sure it really is not output.

Then `npm run replay -- <slug>` and aim for N/N, exactly as for a command page.

## 5. Style guide (apply to every sentence)

An example's `description`, a section's `intro` and a fixture's `note` are rendered as **inline
markdown**, so backtick every flag, path, command and literal string in them (`` `-g` ``,
`` `access.log` ``), and use `[text](/commands/grep/)` for cross-links and `*emphasis*` sparingly.
Each must stay a single paragraph; a blank line or a leading `- ` fails the build. Nothing else on
a page is markdown: `title`, `tagline` and frontmatter `description` are plain text, so a backtick
there ships literally.

**How the prose has to sound is `.claude/reference/voice.md`**, which is the whole answer and is
worth reading before writing a page rather than after. It covers the tells that make writing read
as machine-generated, what is banned outright, and how a section is allowed to end.

The rest is mechanical. **British English in all prose** (`colour`, `flavour`, `behaviour`,
`sanitised`, `organise`, `-ise` not `-ize`) but never touch a real flag, command, package name, or
captured output for spelling (`--color` stays `--color`; a real GNU grep flag). Realistic
placeholders (`access.log`, `~/projects`), never `foo`/`file1`. Show the short flag in code;
mention the long form in prose when it aids memory. Titles are outcomes ("Find files modified in
the last 24 hours"), not syntax ("Using -mtime"). Every page links ≥ 2 related pages using
root-relative paths (`/concepts/pipes-and-redirection/`).

## 6. Verify before calling it done

Two gates, and a command page needs both:

1. `npm run check` (typecheck, tests, build, linkcheck, link audit). Fix any schema violation,
   missing tag, dead `related` link, or broken cross-link it surfaces, and don't hand back a page
   that fails this.
2. `npm run replay -- <command>` for any page with fixtures, and report the score (it starts and
   stops its own sandbox; `npx tsx scripts/replay-command-page.ts <sandbox> <command>
   scripts/fixtures/<command>.sh` is the same check against a sandbox you're already holding).
   `npm run check` validates *shape*; only the replay checks whether the outputs are true, which
   is the site's actual promise.
3. **`npm run replay` with no arguments** when the change reaches beyond the page: the shared
   fixture bodies in `_common.sh`, anything under `scripts/lib/` or `src/content/`, or the sandbox
   image. Each page runs in its own container (ADR-0020), so a new page cannot break a page you
   never touched, and step 2 is the same check the full run makes. `.claude/skills/ship/SKILL.md`
   has the table of what needs which.

Both gates are also now visible to readers. Every page carries a block at its foot linking the
files that produced it and the command that re-runs them, generated from the page's category and
slug (`src/content/sourcePaths.ts`, ADR-0017). A page written without a setup script says so on the
page itself ("nothing re-runs its examples") rather than only in a counter on `/about/`. That is
deliberate, and it is one more reason the setup script is part of writing the page rather than a
follow-up.

A new page arrives orphaned: its own `related:` list points outward, and nothing points back at
it. `npm run check` now fails on that, and the `cross-link-pages` skill is the pass that fixes it:
the useful link is usually an inline one on a sentence in an existing page that already raises the
question this page answers, not another `related:` entry.

## Notes for future parallel/batch use

This checklist is written so it can be handed to a subagent per page with no extra context
beyond "write page X": everything it needs to self-verify (schema, tags, `npm run check`) is
in steps 2 and 6. The gap when parallelizing across many pages at once: agents can't see each
other's `related:` targets or reuse each other's example ideas, so a consistency pass after the
batch (voice, duplicate examples across pages, cross-links that should exist but don't) is still
a separate step, not something this skill covers solo.
### 4c. Two harness flags worth knowing

`--user` runs the replay as the unprivileged `user` rather than root. Any page about
permissions needs it: root bypasses the checks such a page documents, so `chmod 600 /etc/shadow`
succeeds as root and can never print the "Operation not permitted" the page shows. Prefer
recording it as `# verify: --user` in the page's setup script rather than typing the flag, since
both tools read it, which is what stops a page being captured as `user` and later checked as
root, or the reverse. The flag remains for a page that has no setup script yet.

`adopt-real-output.ts ... --all` takes every example's real output instead of named titles,
which is the right move after changing a page's fixtures wholesale. It honours the `.skip` file
and matches titles exactly.

### 4d. What your own examples change, and what the restore does not undo

Your page gets a container to itself (ADR-0020), so nothing another page installs, configures,
binds or leaves running can reach it, and `npm run replay -- <slug>` is authoritative rather than
indicative. **Everything below is about your page changing state on itself.**

The restore before each example empties the page's working directory and re-runs your setup
script. It does not undo anything either of them did elsewhere. So an example that installs a
package, writes to `/etc`, adds a user or starts a background process has changed what every later
example on the page sees, and the later example is the one that fails.

- **Normalise what you need at the start; don't trust what the last example left.** The apt pages
  rewrite the `apt.conf` fragment they want and reset their own marks and holds on every run,
  because an `apt-mark auto` from three examples earlier is enough to change a later one.
- **Check what you touch outside the working directory.** The working directory is emptied for
  you. `/etc`, `/var/lib`, the package database, the user database, the GPG keyring and any
  background process an example starts are not.
- **Prefer a page-local name.** Your own port, your own package names, your own user, as
  `packages-kept-back` does with `tips-demo` and `tips-extra` on 8082. It costs nothing and it
  keeps two examples on one page out of each other's way.

Two lessons from the era when pages shared a container are worth keeping, because both were
defects in a page rather than in the arrangement that exposed them. `wc` counted accounts with
`wc -l < /etc/passwd` and published the answer as exact, which was a machine-specific number
whoever read it would not reproduce. And `third-party-repositories` signed its repository with
`gpg --clearsign` and no `--local-user`, which only ever worked while exactly one key existed.
**Output that depends on how much has happened to the machine is wrong even when it reproduces**,
and isolation makes that class quieter rather than absent. ADR-0002 has the rest of that history.
