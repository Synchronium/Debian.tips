import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "../src/build.js";
import { loadContent } from "../src/content/loader.js";

const FIXTURE_CONTENT = join(import.meta.dirname, "fixtures", "content");
let distDir: string;

beforeAll(async () => {
  distDir = mkdtempSync(join(tmpdir(), "debian-tips-build-test-"));
  await build(FIXTURE_CONTENT, distDir);
});

afterAll(() => {
  rmSync(distDir, { recursive: true, force: true });
});

function read(...parts: string[]): string {
  return readFileSync(join(distDir, ...parts), "utf-8");
}

describe("build (fixture pipeline)", () => {
  it("emits the home page, category listings, tag pages, feeds, and 404", () => {
    expect(read("index.html")).toContain("<html");
    expect(read("commands", "index.html")).toContain("Commands");
    expect(read("scripting", "index.html")).toContain("Scripting");
    expect(read("tags", "index.html")).toContain("demo");
    expect(read("tags", "demo", "index.html")).toContain("greet");
    expect(read("404.html")).toContain("Page not found");
    expect(read("sitemap.xml")).toContain("<urlset");
    expect(read("feed.xml")).toContain("<feed");
  });

  it("renders the command page with its examples and a copy button", () => {
    const html = read("commands", "greet", "index.html");
    expect(html).toContain("greet");
    expect(html).toContain("Say hello");
    expect(html).toContain('data-copy="echo &quot;hello&quot;"');
    expect(html).toContain("callout-note");
  });

  it("copies public/ assets and writes a hashed stylesheet", () => {
    expect(read("CNAME")).toContain("debian.tips");
    expect(() => read(".nojekyll")).not.toThrow();
  });
});

describe("loadContent (fixtures) — scripting prev/next ordering", () => {
  it("orders scripting pages by `order` and links prev/next by title and url", async () => {
    const { pages } = await loadContent(FIXTURE_CONTENT);
    const lessonOne = pages.find((p) => p.slug === "lesson-one")!;
    const lessonTwo = pages.find((p) => p.slug === "lesson-two")!;

    expect(lessonOne.prev).toBeUndefined();
    expect(lessonOne.next).toEqual({ url: "/scripting/lesson-two/", title: "Lesson two" });
    expect(lessonTwo.prev).toEqual({ url: "/scripting/lesson-one/", title: "Lesson one" });
    expect(lessonTwo.next).toBeUndefined();
  });

  it("derives URLs from category and slug", async () => {
    const { pages } = await loadContent(FIXTURE_CONTENT);
    const greet = pages.find((p) => p.slug === "greet")!;
    expect(greet.url).toBe("/commands/greet/");
  });
});
