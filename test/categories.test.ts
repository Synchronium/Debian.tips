import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES, PROSE_CATEGORIES } from "../src/content/schema.js";
import { CATEGORY_META, COMMAND_GROUPS, NAV_ORDER } from "../src/config.js";
import { commandsDir } from "../src/paths.js";

/* A category is declared in `schema.ts` and rendered from `config.ts`. Adding one to
 * `CATEGORIES` alone gives its pages a working URL and no listing page, no nav entry and no
 * sitemap entry, meaning pages that exist and cannot be reached. The reverse is worse: a `NAV_ORDER`
 * entry with no pages behind it ships a header link to an empty page. */

describe("category configuration", () => {
  it("gives every category a label, path and description", () => {
    for (const category of CATEGORIES) {
      const meta = CATEGORY_META[category];
      expect(meta, `no CATEGORY_META for "${category}"`).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.path).toBe(`/${category}/`);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("navigates to every category exactly once", () => {
    expect([...NAV_ORDER].sort()).toEqual([...CATEGORIES].sort());
  });

  it("derives the prose categories as everything but commands", () => {
    expect(PROSE_CATEGORIES).not.toContain("commands");
    expect(PROSE_CATEGORIES.length).toBe(CATEGORIES.length - 1);
  });
});

/* `COMMAND_GROUPS` decides which section of `/commands/` a page appears under, and a slug that
 * matches nothing falls silently into the "More commands" catch-all. Silently is the problem:
 * the page builds, links, replays and reads correctly, and is simply filed in the wrong place on
 * the site's primary index. A group naming a slug no page has is the same defect from the other
 * side, and looks identical. */
describe("command page grouping", () => {
  it("files every command page under a real group, not the catch-all", () => {
    const grouped = new Set(COMMAND_GROUPS.flatMap((group) => group.commands));
    const pages = readdirSync(commandsDir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(pages.length).toBeGreaterThan(0);
    expect(pages.filter((slug) => !grouped.has(slug))).toEqual([]);
  });
});
