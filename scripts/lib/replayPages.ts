// Which pages a full replay is over.
//
// Command pages and prose pages state their claims differently, in `examples.yaml` and in
// Markdown fences, so the two run through different replays and are kept apart here. Everything
// that needs the set reads it from this file rather than walking `content/` again: the replay
// itself, the shard partition it feeds, and the check that the recorded timings still describe
// the site. A second copy of this walk would drift, and the way it would drift is a page missing
// from one list and present in another, which reads as a page nobody has to explain.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { COMMANDS_CATEGORY, PROSE_CATEGORIES, type Category } from "../../src/content/schema.js";
import { CONTENT_DIR, commandsDir, fixtureScript, proseSlug } from "../../src/paths.js";

/** Every command page, by slug. One directory per command under `content/commands/`. */
export function commandPages(): string[] {
  return readdirSync(commandsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** Every prose page, by slug, across all the categories that are a Markdown file each. */
export function prosePages(): string[] {
  return PROSE_CATEGORIES.flatMap((category) =>
    existsSync(join(CONTENT_DIR, category))
      ? readdirSync(join(CONTENT_DIR, category)).flatMap((file) => proseSlug(file) ?? [])
      : [],
  );
}

/** Both kinds together: every page on the site, whether or not anything replays it.
 *
 *  Not the set a full run replays, and the distinction is the whole reason for the name. A page
 *  opts into the replay by having a setup script, so the run filters this list through
 *  `hasSetupScript` and partitions what is left. Calling this "replayable" cost
 *  `test/replayTimings.test.ts` a defect: it compared recorded timings against every page, and a
 *  page with no setup script can never have one recorded, so enough of them would have made the
 *  test permanently red with a remedy that could not clear it. */
export function allPages(): string[] {
  return [...commandPages(), ...prosePages()];
}

/** The site-wide name for a page, `category/slug`.
 *
 *  A run calls a page by its bare slug. That is what names its setup script and what you type to
 *  replay one. Anything *stored* per page is keyed this way instead, so that two files of per-page
 *  data can be read side by side. `scripts/replay-timings.json` and
 *  `test/verification-baseline.json` disagreed about it for as long as both existed.
 *
 *  Throws on a slug two categories share, rather than guessing, because the wrong guess is a page
 *  charged another page's cost and shown another page's estimate, with nothing to say so. Slugs
 *  are unique per category, not site-wide, so a bare one does not always name a page.
 *
 *  Callers pass slugs that a setup script opted in, and it is tempting to argue that those are
 *  always unambiguous: the script is `scripts/fixtures/<slug>.sh`, and two pages cannot own one
 *  file. They cannot, but `hasSetupScript` answers from the filename alone, so when one of two
 *  same-slug pages has a script it says yes to both. `replayableSlugs` is the list that has
 *  already dealt with that, and is what a caller wants. */
export function pageId(page: string): string {
  const found = categoriesOf(page);
  if (found.length === 0) throw new Error(`no page called ${page}`);
  if (found.length > 1) {
    throw new Error(`${page} is ambiguous: ${found.map((c) => `${c}/${page}`).join(", ")}`);
  }
  return `${found[0]}/${page}`;
}

function categoriesOf(page: string): Category[] {
  const found: Category[] = commandPages().includes(page) ? [COMMANDS_CATEGORY] : [];
  for (const category of PROSE_CATEGORIES) {
    const dir = join(CONTENT_DIR, category);
    if (!existsSync(dir)) continue;
    if (readdirSync(dir).some((file) => proseSlug(file) === page)) found.push(category);
  }
  return found;
}

/** Whether a page opts into the replay, which it does by having a setup script.
 *
 *  Here rather than at each call site because three of them ask the same question: the run, to
 *  decide what to put in a container; the shard partition, over what the run selected; and the
 *  timings check, over what could have been recorded. */
export function hasSetupScript(page: string): boolean {
  return existsSync(fixtureScript(page));
}

/** Every slug a full run replays, each naming exactly one page.
 *
 *  What the callers of `hasSetupScript` all wanted, and none of them could ask for. A slug shared
 *  by two pages is legal (`src/content/schema.ts` scopes slugs to a category), and a setup script
 *  carries a slug and no category, so a shared slug with a script attached is a page set nothing
 *  can key by page. `ambiguousSlugs` is that state, reported rather than guessed at.
 *
 *  Also the place duplicates are removed. A shared slug reaches `allPages` twice, and a run over
 *  that list would put the same page in a container twice under one name. */
export function replayableSlugs(): string[] {
  const ambiguous = new Set(ambiguousSlugs());
  return [...new Set(allPages())].filter((page) => hasSetupScript(page) && !ambiguous.has(page));
}

/** Replayable slugs that name more than one page, which is a defect rather than a configuration.
 *
 *  Empty in a healthy repository, and `test/replayTimings.test.ts` holds it that way. Separate
 *  from `replayableSlugs` so that the run and the test can say *which* slugs and what to do about
 *  them, instead of a page quietly dropping out of the replay. */
export function ambiguousSlugs(): string[] {
  return [...new Set(allPages())]
    .filter((page) => hasSetupScript(page) && categoriesOf(page).length > 1)
    .sort();
}
