import { describe, expect, it } from "vitest";
import {
  commandFrontmatterSchema,
  examplesFileSchema,
  frontmatterSchema,
  scriptingFrontmatterSchema,
} from "../src/content/schema.js";

const validDescription = "A description that is long enough to satisfy the fifty character minimum requirement.";

describe("frontmatterSchema", () => {
  it("accepts a valid concepts page", () => {
    const result = frontmatterSchema.safeParse({
      title: "Pipes",
      description: validDescription,
      category: "concepts",
      tags: ["terminal"],
      updated: "2026-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid command page with tagline and tier", () => {
    const result = commandFrontmatterSchema.safeParse({
      title: "grep",
      tagline: "Search text with patterns",
      description: validDescription,
      category: "commands",
      tags: ["search"],
      updated: "2026-01-01",
      tier: "standard",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a command page missing tagline/tier", () => {
    const result = frontmatterSchema.safeParse({
      title: "grep",
      description: validDescription,
      category: "commands",
      tags: ["search"],
      updated: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid scripting page with order", () => {
    const result = scriptingFrontmatterSchema.safeParse({
      title: "Variables",
      description: validDescription,
      category: "scripting",
      tags: ["scripting"],
      updated: "2026-01-01",
      order: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a scripting page missing order", () => {
    const result = frontmatterSchema.safeParse({
      title: "Variables",
      description: validDescription,
      category: "scripting",
      tags: ["scripting"],
      updated: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description shorter than 50 characters", () => {
    const result = frontmatterSchema.safeParse({
      title: "Pipes",
      description: "Too short.",
      category: "concepts",
      tags: ["terminal"],
      updated: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description longer than 160 characters", () => {
    const result = frontmatterSchema.safeParse({
      title: "Pipes",
      description: "x".repeat(161),
      category: "concepts",
      tags: ["terminal"],
      updated: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 6 tags", () => {
    const result = frontmatterSchema.safeParse({
      title: "Pipes",
      description: validDescription,
      category: "concepts",
      tags: ["a", "b", "c", "d", "e", "f", "g"],
      updated: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero tags", () => {
    const result = frontmatterSchema.safeParse({
      title: "Pipes",
      description: validDescription,
      category: "concepts",
      tags: [],
      updated: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid date", () => {
    const result = frontmatterSchema.safeParse({
      title: "Pipes",
      description: validDescription,
      category: "concepts",
      tags: ["terminal"],
      updated: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a tagline over 60 characters on a command page", () => {
    const result = commandFrontmatterSchema.safeParse({
      title: "grep",
      tagline: "x".repeat(61),
      description: validDescription,
      category: "commands",
      tags: ["search"],
      updated: "2026-01-01",
      tier: "standard",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown tier", () => {
    const result = commandFrontmatterSchema.safeParse({
      title: "grep",
      tagline: "Search text with patterns",
      description: validDescription,
      category: "commands",
      tags: ["search"],
      updated: "2026-01-01",
      tier: "ultra",
    });
    expect(result.success).toBe(false);
  });
});

describe("examplesFileSchema", () => {
  it("accepts a minimal valid file", () => {
    const result = examplesFileSchema.safeParse({
      command: "grep",
      sections: [
        {
          title: "Basics",
          examples: [{ title: "Search", code: "grep foo", description: "Finds foo.", level: "basic" }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a section with zero examples", () => {
    const result = examplesFileSchema.safeParse({
      command: "grep",
      sections: [{ title: "Basics", examples: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an example with an invalid level", () => {
    const result = examplesFileSchema.safeParse({
      command: "grep",
      sections: [
        {
          title: "Basics",
          examples: [{ title: "Search", code: "grep foo", description: "Finds foo.", level: "expert" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an example with empty code", () => {
    const result = examplesFileSchema.safeParse({
      command: "grep",
      sections: [
        {
          title: "Basics",
          examples: [{ title: "Search", code: "", description: "Finds foo.", level: "basic" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
