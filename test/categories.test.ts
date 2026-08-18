import { describe, expect, it } from "vitest";
import { CATEGORIES, PROSE_CATEGORIES } from "../src/content/schema.js";
import { CATEGORY_META, NAV_ORDER } from "../src/config.js";

/* A category is declared in `schema.ts` but rendered from `config.ts`, and nothing connected
 * the two. Adding one to `CATEGORIES` alone gives its pages a working URL and no listing page,
 * no nav entry and no sitemap entry — pages that exist and cannot be reached. The reverse is
 * worse: a `NAV_ORDER` entry with no pages behind it ships a header link to an empty page. */

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
