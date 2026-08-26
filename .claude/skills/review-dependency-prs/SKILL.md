---
name: review-dependency-prs
description: Review and merge Dependabot pull requests on debian.tips: grouped minor/patch bumps, individual majors, GitHub Actions and devcontainer updates. Use when asked to deal with, review, triage or merge dependency PRs or Dependabot PRs. Explains what each ecosystem can break here.
---

# Review Dependabot PRs

```sh
gh pr list --author "app/dependabot"
gh pr view <n> --json title,body,files --jq '.title, (.files[].path)'
```

## What is actually at risk here

Every npm dependency in this repo is a **devDependency**. Nothing is shipped to a visitor's
browser: the output is static HTML, CSS and a little hand-written JS. So a bad bump cannot
introduce a runtime vulnerability on the site. It can break the build, or change the generated
HTML, and the second one is the one to look for, because it passes a typecheck.

That inverts the usual review. The question is not "is this version safe" but "does the site
still render and replay the same".

## Two shapes of PR, by design

`.github/dependabot.yml` groups **minor and patch** updates per ecosystem, so a week of routine
bumps arrives as one PR. **Majors are deliberately excluded from the groups** and arrive one per
PR. Grouping them once produced a single merge button carrying TypeScript 5→7, Shiki 1→4, Zod
3→4 and `@types/node` 22→26, next to a vitest patch.

**Grouped minor/patch:** CI green is close to sufficient. Read the file list, confirm it is only
`package.json`/`package-lock.json`, and merge.

**A major:** check it out and run the real gates locally. CI does not run pa11y against a
rebuilt Shiki in a way that proves the contrast patch still applies, and it does not tell you
the HTML changed, only that it built.

```sh
gh pr checkout <n>
npm ci
npm run check
npm run replay          # everything: a rendering change is not page-local
```

## What each major can break

| package | what to check |
| --- | --- |
| **shiki** | Highlighting is baked into every page's HTML. `LIGHT_CONTRAST_FIXES` in `src/content/markdown.ts` rewrites two literal hex colours (`#D73A49`, `#6A737D`) that fail WCAG AA on this site's light background. If a new `github-light` retints those tokens, the regexes match nothing, no error is raised, and the site ships failing contrast. Grep the built CSS/HTML for both old and new values, and run pa11y. |
| **typescript** | It is the only static check in the repo, since there is no linter. A major can surface real errors that were always there, which is worth fixing rather than suppressing. |
| **zod** | `src/content/schema.ts` is the single source of truth for what a page may contain. Check that an invalid page still *fails*, not just that valid ones pass: `npx vitest run test/schema.test.ts`. |
| **pagefind** | Owns the search index. Confirm `dist/pagefind/` is produced and the indexed page count in the build output has not collapsed. |
| **vitest** | If tests pass, it is fine. A major may change config or globals. |
| **remark/rehype/unified** | Markdown rendering. Callouts, heading slugs and autolinks are custom plugins, so `npx vitest run test/markdown.test.ts` covers them, and `npm run check`'s linkcheck catches broken `#fragment` targets if slugging changed. |
| **@types/node** | Types only. A failure is a compile error, not a runtime one. |

Run pa11y locally when rendering is involved:

```sh
npm run build && npx serve -l 4321 dist & npx wait-on http://localhost:4321 && npm run a11y
```

## The two ecosystems you cannot fully test

**`github-actions`** bumps only prove themselves by running. CI exercises the actions in
`ci.yml` on the PR itself, so a green run is real evidence. `deploy.yml`'s actions are *not*
exercised by a PR, because Deploy only triggers on `workflow_run` against `main`, so an
`actions/deploy-pages` or `upload-pages-artifact` bump is unproven until it lands. Merge those
on their own rather than in a batch, and check the first Deploy afterwards. `deploy.yml` also
accepts `workflow_dispatch`, so a deploy can be re-run by hand without pushing a commit if one
of those bumps turns out to be broken.

**`devcontainers`** bumps change the environment this agent is running inside. They cannot be
verified from within it, and a rebuild is the user's action, not something to merge and hope.
Say so, and ask them to rebuild and confirm before merging: the base image and the
docker-in-docker feature are what the whole sandbox depends on.

## Merging

```sh
gh pr checks <n>            # both CI jobs, not just one
gh pr merge <n> --squash --delete-branch
```

Do not merge a major on a green `check` alone. `check` validates shape; only the replay says the
pages still print what they claim, and a rendering change is exactly the kind that keeps the
types happy.

If a bump has to be held back, say why in the PR rather than closing it silently, since Dependabot
will reopen it next week and the reasoning will be gone.
