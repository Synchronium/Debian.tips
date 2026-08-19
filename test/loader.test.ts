import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContentError, loadContent } from "../src/content/loader.js";

const VALID_FIXTURE = join(import.meta.dirname, "fixtures", "content");
const tempDirs: string[] = [];

/** Copies the valid fixture tree, applies `mutate`, and returns the broken copy's path.
 * Building invalid trees at test time (rather than checking dozens of near-identical
 * fixture directories into the repo) keeps each case readable as a single diff. */
function brokenContent(mutate: (dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "debian-tips-loader-test-"));
  tempDirs.push(dir);
  cpSync(VALID_FIXTURE, dir, { recursive: true });
  mutate(dir);
  return dir;
}

function editFile(file: string, replace: (source: string) => string): void {
  writeFileSync(file, replace(readFileSync(file, "utf-8")), "utf-8");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loadContent — validation", () => {
  it("accepts the valid fixture tree (positive control)", async () => {
    await expect(loadContent(VALID_FIXTURE)).resolves.toBeDefined();
  });

  it("rejects frontmatter that fails the schema", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace(/^description: .*$/m, 'description: "too short"'),
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(/invalid frontmatter/);
  });

  it("rejects a page tag that isn't in the registry", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("tags: [demo]", "tags: [not-registered]"),
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(/unknown tag "not-registered"/);
  });

  it("rejects an example-level tag that isn't in the registry", async () => {
    const dir = brokenContent((d) =>
      editFile(
        join(d, "commands", "greet", "examples.yaml"),
        (s) => `${s}\n        tags: [not-registered]\n`,
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(/unknown example tag "not-registered"/);
  });

  /** Writes a second page reusing an existing slug in another category. The slug namespace is
   *  no longer global, so this is legal on its own and only becomes an error when something
   *  downstream actually needs to tell the two apart. */
  function withReusedSlug(dir: string, slug: string, related?: string): void {
    mkdirSync(join(dir, "concepts"), { recursive: true });
    writeFileSync(
      join(dir, "concepts", `${slug}.md`),
      [
        "---",
        `title: "${slug}, again"`,
        `description: "A second page deliberately reusing the ${slug} slug, in another category."`,
        "category: concepts",
        "tags: [demo]",
        "updated: 2026-01-01",
        ...(related ? [`related: [${related}]`] : []),
        "---",
        "",
        "Body.",
      ].join("\n"),
      "utf-8",
    );
  }

  it("allows a slug to be reused in another category", async () => {
    const dir = brokenContent((d) => withReusedSlug(d, "greet"));
    const { pages } = await loadContent(dir);
    expect(
      pages
        .filter((p) => p.slug === "greet")
        .map((p) => p.url)
        .sort(),
    ).toEqual(["/commands/greet/", "/concepts/greet/"]);
  });

  it("rejects a bare related: slug that two pages answer to", async () => {
    const dir = brokenContent((d) => {
      withReusedSlug(d, "greet");
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("order: 1", "order: 1\nrelated: [greet]"),
      );
    });
    await expect(loadContent(dir)).rejects.toThrow(
      /related slug "greet" is ambiguous \(commands\/greet, concepts\/greet\) — write it as "category\/slug"/,
    );
  });

  it("resolves a qualified related: reference to the page it names", async () => {
    const dir = brokenContent((d) => {
      withReusedSlug(d, "greet");
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("order: 1", "order: 1\nrelated: [concepts/greet]"),
      );
    });
    const { pages } = await loadContent(dir);
    const lessonOne = pages.find((p) => p.slug === "lesson-one")!;
    expect(lessonOne.relatedLinks).toEqual([{ url: "/concepts/greet/", title: "greet, again" }]);
  });

  it("rejects a qualified related: reference to a page that doesn't exist", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("order: 1", "order: 1\nrelated: [concepts/nothing-here]"),
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(/related page "concepts\/nothing-here" does not exist/);
  });

  it("rejects a related: slug that doesn't exist", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("order: 1", "order: 1\nrelated: [nonexistent]"),
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(/related slug "nonexistent" does not exist/);
  });

  it("rejects a published page linking to a draft page", async () => {
    const dir = brokenContent((d) => {
      editFile(join(d, "scripting", "lesson-two.md"), (s) => s.replace("order: 2", "order: 2\ndraft: true"));
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("order: 1", "order: 1\nrelated: [lesson-two]"),
      );
    });
    await expect(loadContent(dir)).rejects.toThrow(/related page "lesson-two" is a draft/);
  });

  it("allows a draft page to link to a published page", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-two.md"), (s) =>
        s.replace("order: 2", "order: 2\ndraft: true\nrelated: [lesson-one]"),
      ),
    );
    await expect(loadContent(dir)).resolves.toBeDefined();
  });

  it("rejects two scripting lessons sharing an order", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-two.md"), (s) => s.replace("order: 2", "order: 1")),
    );
    await expect(loadContent(dir)).rejects.toThrow(/duplicate scripting order 1/);
  });

  it("rejects frontmatter whose category doesn't match its directory", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("category: scripting", "category: concepts"),
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(/does not match directory "scripting"/);
  });

  it("rejects a command directory with no index.md", async () => {
    const dir = brokenContent((d) => unlinkSync(join(d, "commands", "greet", "index.md")));
    await expect(loadContent(dir)).rejects.toThrow(/is missing index\.md/);
  });

  it("rejects a command directory with no examples.yaml", async () => {
    const dir = brokenContent((d) => unlinkSync(join(d, "commands", "greet", "examples.yaml")));
    await expect(loadContent(dir)).rejects.toThrow(/is missing examples\.yaml/);
  });

  it("rejects an examples.yaml whose command: doesn't match its directory", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "commands", "greet", "examples.yaml"), (s) =>
        s.replace("command: greet", "command: farewell"),
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(/command "farewell" does not match directory "greet"/);
  });

  it("rejects an examples.yaml that fails the schema", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "commands", "greet", "examples.yaml"), (s) =>
        s.replace(/^\s+level: .*$/m, "        level: nope"),
      ),
    );
    await expect(loadContent(dir)).rejects.toThrow(ContentError);
  });

  it("rejects a tags.yaml that fails the schema", async () => {
    const dir = brokenContent((d) => writeFileSync(join(d, "tags.yaml"), "tags: []\n", "utf-8"));
    await expect(loadContent(dir)).rejects.toThrow(/tags\.yaml is invalid/);
  });

  it("throws ContentError specifically, not a bare Error", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-one.md"), (s) =>
        s.replace("tags: [demo]", "tags: [not-registered]"),
      ),
    );
    await expect(loadContent(dir)).rejects.toBeInstanceOf(ContentError);
  });
});

describe("loadContent — validation is environment-independent", () => {
  const withNodeEnv = async (value: string | undefined, fn: () => Promise<void>): Promise<void> => {
    const previous = process.env["NODE_ENV"];
    if (value === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = value;
    try {
      await fn();
    } finally {
      if (previous === undefined) delete process.env["NODE_ENV"];
      else process.env["NODE_ENV"] = previous;
    }
  };

  // Validation used to run only against production-visible pages, so a draft could
  // mask a real error locally and only fail in CI (which sets NODE_ENV=production).
  it("reports a draft page's broken related: link in both dev and production", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-two.md"), (s) =>
        s.replace("order: 2", "order: 2\ndraft: true\nrelated: [nonexistent]"),
      ),
    );
    await withNodeEnv(undefined, async () => {
      await expect(loadContent(dir)).rejects.toThrow(/related slug "nonexistent" does not exist/);
    });
    await withNodeEnv("production", async () => {
      await expect(loadContent(dir)).rejects.toThrow(/related slug "nonexistent" does not exist/);
    });
  });

  it("reports a draft page's unknown tag in both dev and production", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-two.md"), (s) =>
        s.replace("tags: [demo]", "tags: [not-registered]").replace("order: 2", "order: 2\ndraft: true"),
      ),
    );
    await withNodeEnv(undefined, async () => {
      await expect(loadContent(dir)).rejects.toThrow(/unknown tag "not-registered"/);
    });
    await withNodeEnv("production", async () => {
      await expect(loadContent(dir)).rejects.toThrow(/unknown tag "not-registered"/);
    });
  });

  it("still excludes drafts from the emitted page set in production only", async () => {
    const dir = brokenContent((d) =>
      editFile(join(d, "scripting", "lesson-two.md"), (s) => s.replace("order: 2", "order: 2\ndraft: true")),
    );
    await withNodeEnv(undefined, async () => {
      const { pages } = await loadContent(dir);
      expect(pages.map((p) => p.slug)).toContain("lesson-two");
    });
    await withNodeEnv("production", async () => {
      const { pages } = await loadContent(dir);
      expect(pages.map((p) => p.slug)).not.toContain("lesson-two");
    });
  });
});
