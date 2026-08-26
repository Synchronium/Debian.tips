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
import { CONTENT_DIR, commandsDir, proseSlug } from "../../src/paths.js";

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

/** Both kinds together, which is what a full run replays and what a shard partitions. */
export function replayablePages(): string[] {
  return [...commandPages(), ...prosePages()];
}
