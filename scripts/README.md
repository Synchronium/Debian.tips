# scripts/

Everything here is a tool, not part of the site. `src/` builds the site; these check it, replay it,
or keep a checked-in file current. The split is by who runs a thing and when, because that is the
question someone arriving here has.

`scripts/` may import from `src/`, and never the other way round. ADR-0028 says why, and
`test/moduleBoundary.test.ts` holds it.

## replay/

The verification harness: the thing that makes the site's central claim true. It puts a page in a
throwaway Debian container, runs every example the page documents, and diffs what the command
printed against what the page says it printed.

| | |
| --- | --- |
| `all.ts` | `npm run replay`. Every page, or the ones you name, one container each. |
| `command-page.ts` | One command page, against its `examples.yaml`. |
| `prose-page.ts` | One prose page, against the fenced blocks in its Markdown. |
| `sandbox.sh` | Starts, stops and execs into a container. The one you run by hand while writing. |
| `sandbox/` | The image those containers are built from. |
| `ghcr-tag-readable.sh` | Names the published image for `.github/workflows/publish-sandbox.yml`. |

`.claude/reference/verification.md` is the long-form explanation, and ADR-0001 and ADR-0020 are the
decisions behind it.

## gates/

Checks that pass or fail. Each is wired into `npm run check`, `npm run <name>`, or a CI job.

| | |
| --- | --- |
| `link-audit.ts` | Which pages nothing links to. `src/linkcheck.ts` checks the links that exist resolve; ADR-0015 is why they are two gates. |
| `voice-check.ts` | Prose against `.claude/reference/voice.md`. Also runs per file, from a hook. |
| `browser-check.ts` | Search and narrow-screen layout, in a real browser against a served build. |
| `pa11y-urls.ts` | Writes the URL list `pa11y-ci` reads. Never run `pa11y-ci` without it. |

## authoring/

Run by hand while writing or fixing a page. Both write to `content/`, so read what they changed
before committing it.

| | |
| --- | --- |
| `adopt-real-output.ts` | Replaces a page's documented output with what the command actually printed. |
| `fix-output-whitespace.ts` | Repairs trailing whitespace in an `output:` block that YAML would mangle. |

## maintain/

Keeps a checked-in file current. Some are run by hand, some by a workflow; none of them gate
anything.

| | |
| --- | --- |
| `update-verification-baseline.ts` | Rewrites `test/verification-baseline.json` after an intended change. |
| `merge-timings.ts` | Merges what each CI shard measured into `scripts/replay-timings.json`. |
| `check-shard-count.ts` | `npm run shards`: whether the shard count in `ci.yml` still suits the timings. |
| `og-image.ts` | Redraws `public/og-default.png` from `styles/site.css`. |

## lib/

Shared by the tools above, and not run directly. The replay's normalisation rules, the shard
partition, the link graph, the sandbox driver.

## fixtures/

A setup script per page, and what opts that page into the replay. It has a README of its own.
