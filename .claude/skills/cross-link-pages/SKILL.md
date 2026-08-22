---
name: cross-link-pages
description: Audit and repair the cross-linking between debian.tips content pages: orphaned pages nothing links to, pages that link nowhere, and weakly-connected ones. Use after writing or renaming a page, after a batch of pages, or when asked to check cross-links, find orphans, or fix the related: graph. Not for broken links, which npm run check already catches.
---

# Cross-link debian.tips pages

A new page arrives orphaned. Nothing links to it, because nothing knew it was coming, and
`npm run check` is perfectly happy, because every link that exists resolves. Discoverability is
the one part of a page nothing in the build has an opinion about, so it needs its own pass.

Run this after adding a page, after a batch, and after renaming a slug.

## 1. Get the report

```sh
npm run audit:links -- --verbose
```

`--verbose` is what you want here: the bare form is the one wired into `npm run check`, and it
reduces the advisory list to a count so it doesn't bury the gate's real output.

It prints three lists and exits non-zero if either of the first two has entries:

| | what it means | treat as |
| --- | --- | --- |
| **orphaned** | no other page links here, by `related:` or in prose | defect, always fix |
| **thin** | fewer than 2 links out, the style guide's floor | defect, always fix |
| **weakly linked** | exactly one page links here | judgement, fix the obvious ones |

Each entry comes with a `could link from:` list: the pages that share a tag and don't already
link there, closest first. Those are candidates, not instructions.

The graph counts two kinds of edge, and they are not equivalent:

- **`related:` frontmatter**: renders as a "Related" block. Cheap to add, easy to overdo.
- **an inline link in prose**: in a page body, an example `description`, a section `intro`, or a
  fixture `note`. Worth more, because it arrives at the moment a reader wants it.

What the audit deliberately does not report is one-way `related:`, meaning A lists B while B does not
list A. The graph is hubs and spokes: `grep` and `exit-codes-and-error-handling` are linked from
everywhere, and reciprocating all of it would give them a related list naming half the site.
Asymmetry is the normal shape here. Don't go hunting for it.

## 2. Fix it prose-first

For each orphan, the question is not "which page can I bolt a link onto" but **"which page's
reader wants this one, and where in that page do they want it?"** Work in this order:

1. **Look for a mention that is already there and isn't a link.** This is the best possible fix
   and it is common, because prose gets written before the page it refers to exists.
   `grep -rn "journalctl" content/` found a recipe explaining `journalctl -u servicename -f` in
   plain text, and a whole concept page about `chmod` that never linked to `/commands/chmod/`.
   Search the new page's command name and its obvious synonyms across `content/` before anything
   else.
2. **Look for the sentence that raises the question the new page answers.** `sed`'s warning about
   `-i` destroying a file with no backup is exactly where a reader wants `diff`. `cut`'s note that
   padded columns need a workaround is where they want `awk`. A link placed on the sentence that
   creates the need reads as help; the same link in a list at the bottom reads as filler.
3. **Add the `related:` entry as well**, once the prose link exists. Both count, and the block at
   the bottom is what serves a reader who is browsing rather than stuck.
4. **`related:`-only is acceptable** when the connection is real but no existing sentence sets it
   up, as `find` does to the bulk-rename recipe. It is the weaker fix; don't use it first.

Then check the reverse direction: a new page's own `related:` list should name the pages it
genuinely builds on, and its prose should link them where they come up.

## 3. Rules for the links themselves

- Root-relative, trailing slash: `[grep](/commands/grep/)`, `/concepts/…/`, `/recipes/…/`,
  `/scripting/…/`, `/debian/…/`. Never a bare slug, never a relative path.
- `related:` takes **slugs**, not paths, and every slug must exist or the build fails.
- Link text says what is on the other end. `[`journalctl -u`](/commands/journalctl/)` beats
  "see the journalctl page", and both beat "click here".
- Inline markdown works in an example `description`, a section `intro` and a fixture `note`, and
  nowhere else on a command page. A link in `title`, `tagline` or frontmatter `description` ships
  as literal backticks and brackets.
- Adding a **paragraph** to justify a link is fine and often the right call, but it is content,
  so it follows the content rules: British English, second person, and any command in it has to be
  true. Two claims added during one of these passes were checked in the sandbox before the pass
  was called done, and one of them was about output nobody had run.
- `/about/` is reached from the header and the homepage. It is exempt from the orphan check for
  that reason, and content pages are not expected to link it. Don't force one.

## 4. Verify

```sh
npm run check   # runs the audit last, after linkcheck
```

The audit proves the links you meant to add are there; linkcheck proves they go somewhere. A pass
needs both, since it is entirely possible to fix an orphan with a link that 404s, and the audit alone
would call that clean.

Drafts are exempt from both defect checks. A published page linking to a `draft: true` page is a
build error, so a draft can only be linked from another draft and would be reported as an orphan
every time. It gets audited when it is published.

If a page whose `examples.yaml` you edited has a setup script, replay it too
(`npm run replay -- <command>`): a link added to an example `description` doesn't change its
output, but it is cheap to be sure you didn't touch the wrong block.
