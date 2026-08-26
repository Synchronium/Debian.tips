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
import { PROSE_CATEGORIES } from "../../src/content/schema.js";
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

/** Whether a page opts into the replay, which it does by having a setup script.
 *
 *  Here rather than at each call site because three of them ask the same question: the run, to
 *  decide what to put in a container; the shard partition, over what the run selected; and the
 *  timings check, over what could have been recorded. */
export function hasSetupScript(page: string): boolean {
  return existsSync(fixtureScript(page));
}
