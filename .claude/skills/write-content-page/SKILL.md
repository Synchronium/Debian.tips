---
name: write-content-page
description: Author or extend one debian.tips content page (command reference, concept, scripting lesson, recipe, or Debian article) to the site's schema, tiering, and style-guide contract. Use when asked to write, draft, or expand a specific page — e.g. "write the sed page", "add examples for tar", "draft the exit-codes-and-error-handling concept", "write recipe: bulk-rename-files". Not for open-ended "what should we write next" planning.
---

# Write a debian.tips content page

One page per invocation. This checklist is self-contained — everything it references
(`src/content/schema.ts`, `content/tags.yaml`, existing content under `content/`) is committed to
the repo, so it works the same for anyone who clones it, not just this working copy. If this
project happens to keep its own internal planning notes locally, they're worth a skim for extra
prose detail, but nothing below depends on them existing.

## 1. Identify the page

From the request, work out:
- **category** (`commands|concepts|scripting|recipes|debian`) → target directory
- **slug** → directory/file name (command pages: `content/commands/<slug>/`; others:
  `content/<category>/<slug>.md`)
- **tier** (commands only: `flagship|standard|light`) — drives length and example count. Judge it
  by comparing to existing pages in `content/commands/`: a big, commonly-reached-for command with
  real depth (grep, find, sed, curl) is flagship; an everyday command with modest scope (tar) is
  standard; a small single-purpose command is light.
- for combined pages covering more than one command (e.g. "job control" covering `jobs`/`fg`/`bg`),
  the primary command is the slug/title; the others get their own `##` sections within the same page

If the category, slug, or tier isn't obvious from the request or from comparable existing
content, stop and ask rather than guessing.

## 2. Check the schema, not just this checklist

Read `src/content/schema.ts` — it's authoritative if anything below has drifted out of sync with
it. Frontmatter needs `title`, `description` (50–160 chars), `tags` (1–6), `updated` (ISO date,
use today), `category`; command pages also need `tagline` (≤60 chars) and `tier`; scripting pages
need a unique `order`. `related` is optional but every slug in it must exist (or be created in
this same batch).

Check `content/tags.yaml` for the allowed tag set. Tags are curated on purpose — if the page
genuinely needs a concept not in the registry, stop and ask before adding one; don't just add it
because a page reads better with it.

## 3. Match structure and length to page type

- **Commands**: `index.md` prose intro (flagship 600–1200 words / standard 150–400 / light
  50–150) + `examples.yaml` (flagship/standard 50–100 examples, light 25–50), sections ordered
  basic → advanced, `command:` field matching the directory name.
- **Concepts**: 800–2000 words — hook → mental model → worked examples → common misconceptions →
  "go deeper" links.
- **Scripting**: one concept, runnable script(s), a pitfalls callout, exercises with `<details>`
  answers; `order` drives prev/next.
- **Recipes**: 300–700 words, rigid **Problem → Solution → How it works → Variations**; one task
  per recipe.
- **Debian**: same shape as concepts, Debian-specific.

## 4. Test every example for real — don't fabricate output

Run every example inside the disposable sandbox (`scripts/sandbox.sh`), not directly on the
devcontainer — it's a throwaway `debian:trixie` container (same "current Debian stable" target),
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
  plausible-looking output — flag it for the user to verify on a real box.
- Destructive examples (`rm`, `dd`, `mkfs`, `chmod -R`, `curl | sh`, etc.) get `danger: true` and
  the description must state the failure mode. Prefer teaching the safe variant first.

### 4a. Rules that a replay pass has actually caught being broken

Every one of these came from real examples on this site that looked fine and weren't. They're
cheap to honour while writing and expensive to find later.

- **The command must produce the output exactly as printed.** Not a variant you ran, not the same
  command with an extra `| tail -n3`, not a different path. `grep -r "TODO" ~/projects` cannot
  print relative paths — the shell expands `~` before grep sees it — so an example showing
  `projects/app/main.ts:…` is unreproducible no matter how plausible it reads.
- **Never abridge an `output:` block silently.** If the real output is 10 lines, show 10 or add a
  `| head -N` to the command so the shown output is complete for what's shown.
- **Commands that write to a file print nothing.** `sed -i`, `sort -o`, `crontab file` produce no
  stdout. Either omit `output:` or make the command show its result (`… && cat file`).
- **Make non-deterministic output deterministic.** awk array iteration order is unspecified (and
  differs between mawk and gawk); `find`, `grep -r` and glob expansion follow directory order,
  which is a hash order you cannot influence — four entries created `a,b,c,d` read back as
  `d,b,c,a`. Pipe through `sort`, or narrow the glob, rather than documenting whatever one run
  happened to print. Checksums count too: two fixture files with identical bytes produce identical
  `md5sum` output, which reads on the page as though the fixture were broken.
- **Don't let an example depend on the whole working directory.** `ls *.txt | wc -l` changes
  answer whenever a fixture is added. Target a stable subset.
- **Right-aligned output needs `output: |2`.** `wc` and `uniq -c` pad their columns. A plain `|`
  block takes its indentation from the first line, so any later line indented *less* is silently
  re-indented (or errors), quietly changing what the page claims the command prints. Use the
  explicit indicator and keep the real padding.

### 4b. Declare the sample data, then prove it

Any example whose output can't be interpreted without seeing its input needs a `fixtures:` entry
— above all where output is a summary (`wc -l file` → `40`) rather than a transformation of the
input. Pages whose output echoes the input (`cut`, `head`) often need none.

- Add a top-level `fixtures:` list to `examples.yaml` (`name`, optional `note`, `content`). It
  renders as one collapsed block above the examples.
- Mirror it in a setup script at `scripts/fixtures/<command>.sh` that recreates those files.
- **If the input is a directory rather than a file** (`find`, `tar`, `ls`, `du`), the fixture is a
  captured `ls -lAR` of the tree — a reader can't evaluate `find projects -mtime +365` printing one
  path without seeing the other nine files and their dates. Capture it from the sandbox rather than
  writing it out: it encodes modes, sizes and mtimes at once, and all three must be set explicitly
  in the setup script. Don't rely on the umask for a mode you assert on: the container's own umask
  is 0000 (a bare `mkdir` gives a 777 directory), and while the replay forces the normal 0022, a
  plain `scripts/sandbox.sh exec` does not — so the same command gives different modes depending
  on how you ran it.
- Then prove the two agree:

```sh
name=$(scripts/sandbox.sh start)
node scripts/verify-examples.mjs "$name" <command> scripts/fixtures/<command>.sh
scripts/sandbox.sh stop "$name"
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

For examples a batch genuinely can't replay (needing a concurrent writer, like `tail -f`, or a
network peer), list the title in `scripts/fixtures/<command>.skip` with a comment saying how it
*was* verified. Don't leave it silently failing, and don't delete the example. Titles are matched
exactly and must name an example that documents an `output:` block — the harness rejects an entry
that matches nothing, because a renamed title otherwise leaves the file claiming an exemption it
no longer grants.

If a page's output depends on who ran the command — file ownership in `ls -l` or `tar -tvf`, a
path under `~`, a permission denial root would never see — put `# verify: --user` in its setup
script. Both `verify-examples.mjs` and `adopt-real-output.mjs` read it, so the command above stays
right for every page. Without it, replaying `chmod` as root reports 9/42 on a page that is
perfectly correct, and that looks exactly like a page that has drifted.

Two helpers exist for repairs: `scripts/fix-output-whitespace.mjs` (rewrites blocks whose only
problem is lost padding — it refuses anything differing in substance) and
`scripts/adopt-real-output.mjs` (replaces named examples' output with the real capture; use when
output was silently abridged).

## 5. Style guide (apply to every sentence)

An example's `description`, a section's `intro` and a fixture's `note` are rendered as **inline
markdown** — backtick every flag, path, command and literal string in them (`` `-g` ``,
`` `access.log` ``), and use `[text](/commands/grep/)` for cross-links and `*emphasis*` sparingly.
Each must stay a single paragraph; a blank line or a leading `- ` fails the build. Nothing else on
a page is markdown: `title`, `tagline` and frontmatter `description` are plain text, so a backtick
there ships literally.

Direct, second person, no fluff, no "In today's fast-paced world." **British English in all
prose** (`colour`, `flavour`, `behaviour`, `sanitised`, `organise`, `-ise` not `-ize`) — but never
touch a real flag, command, package name, or captured output for spelling (`--color` stays
`--color`; a real GNU grep flag). Realistic placeholders (`access.log`, `~/projects`) — never
`foo`/`file1`. Show the short flag in code; mention the long form in prose when it aids memory.
Titles are outcomes ("Find files modified in the last 24 hours"), not syntax ("Using -mtime").
Every page links ≥ 2 related pages using root-relative paths (`/concepts/pipes-and-redirection/`).
Avoid common AI tropes — em dashes, "it's not X, it's Y", "here's why that matters", and similar.

## 6. Verify before calling it done

Two gates, and a command page needs both:

1. `npm run check` (typecheck, tests, build, linkcheck). Fix any schema violation, missing tag,
   dead `related` link, or broken cross-link it surfaces — don't hand back a page that fails this.
2. `node scripts/verify-examples.mjs <sandbox> <command> scripts/fixtures/<command>.sh` for any
   page with fixtures, and report the score. `npm run check` validates *shape*; only the replay
   checks whether the outputs are true, which is the site's actual promise.

## Notes for future parallel/batch use

This checklist is written so it can be handed to a subagent per page with no extra context
beyond "write page X" — everything it needs to self-verify (schema, tags, `npm run check`) is
in steps 2 and 6. The gap when parallelizing across many pages at once: agents can't see each
other's `related:` targets or reuse each other's example ideas, so a consistency pass after the
batch (voice, duplicate examples across pages, cross-links that should exist but don't) is still
a separate step, not something this skill covers solo.
### 4c. Two harness flags worth knowing

`--user` runs the replay as the unprivileged `user` rather than root. Any page about
permissions needs it: root bypasses the checks such a page documents, so `chmod 600 /etc/shadow`
succeeds as root and can never print the "Operation not permitted" the page shows. Prefer
recording it as `# verify: --user` in the page's setup script rather than typing the flag —
both tools read it, which is what stops a page being captured as `user` and later checked as
root, or the reverse. The flag remains for a page that has no setup script yet.

`adopt-real-output.mjs ... --all` takes every example's real output instead of named titles,
which is the right move after changing a page's fixtures wholesale. It honours the `.skip` file
and matches titles exactly.
