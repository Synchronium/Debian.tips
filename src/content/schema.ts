import { z } from "zod";

export const CATEGORIES = ["commands", "concepts", "scripting", "recipes", "debian"] as const;
export type Category = (typeof CATEGORIES)[number];

export const TIERS = ["flagship", "standard", "light"] as const;
export type Tier = (typeof TIERS)[number];

export const LEVELS = ["basic", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

const dateSchema = z.union([z.string(), z.date()]).transform((v, ctx) => {
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid date: ${String(v)}` });
    return z.NEVER;
  }
  return d;
});

const baseFrontmatter = {
  title: z.string().min(1, "title is required"),
  description: z
    .string()
    .min(50, "description must be at least 50 characters")
    .max(160, "description must be at most 160 characters"),
  tags: z
    .array(z.string().min(1))
    .min(1, "at least one tag is required")
    .max(6, "at most 6 tags are allowed"),
  updated: dateSchema,
  related: z.array(z.string()).optional(),
  draft: z.boolean().optional(),
};

export const commandFrontmatterSchema = z.object({
  ...baseFrontmatter,
  category: z.literal("commands"),
  tagline: z.string().min(1).max(60, "tagline must be at most 60 characters"),
  tier: z.enum(TIERS),
});

export const scriptingFrontmatterSchema = z.object({
  ...baseFrontmatter,
  category: z.literal("scripting"),
  order: z.number().int().positive(),
});

export const conceptsFrontmatterSchema = z.object({ ...baseFrontmatter, category: z.literal("concepts") });
export const recipesFrontmatterSchema = z.object({ ...baseFrontmatter, category: z.literal("recipes") });
export const debianFrontmatterSchema = z.object({ ...baseFrontmatter, category: z.literal("debian") });

export const frontmatterSchema = z.discriminatedUnion("category", [
  commandFrontmatterSchema,
  scriptingFrontmatterSchema,
  conceptsFrontmatterSchema,
  recipesFrontmatterSchema,
  debianFrontmatterSchema,
]);

export type Frontmatter = z.infer<typeof frontmatterSchema>;
export type CommandFrontmatter = z.infer<typeof commandFrontmatterSchema>;
export type ScriptingFrontmatter = z.infer<typeof scriptingFrontmatterSchema>;

export const exampleSchema = z.object({
  title: z.string().min(1),
  code: z.string().min(1),
  description: z.string().min(1),
  output: z.string().optional(),
  /** Reserved, deliberately: validated and authored on every example, but no template
   * renders it yet. Kept for a future difficulty badge / filter. Don't "clean up" as
   * dead data, and keep setting it accurately when authoring — backfilling 600+
   * examples later would be far more expensive than getting it right up front.
   * `level` is conceptual difficulty; it is *not* a proxy for the `beginner` tag below
   * (only 78 of 169 `basic` examples carry it, and 20 `advanced` ones do). */
  level: z.enum(LEVELS),
  /** Reserved, same as `level` — validated against content/tags.yaml so a typo still
   * fails the build, but not rendered anywhere yet. Coverage is currently partial
   * (~47% of examples), so anything built on it needs to handle untagged examples. */
  tags: z.array(z.string()).optional(),
  danger: z.boolean().optional(),
});
export type Example = z.infer<typeof exampleSchema>;

export const exampleSectionSchema = z.object({
  title: z.string().min(1),
  intro: z.string().optional(),
  examples: z.array(exampleSchema).min(1, "each section needs at least one example"),
});
export type ExampleSection = z.infer<typeof exampleSectionSchema>;

/** The sample data an example's `output:` was actually produced against. Without it a
 * reader can't evaluate output that doesn't echo its input — `wc -l report.txt` printing
 * "40" is unverifiable unless report.txt is on the page somewhere. Contents must be
 * captured from a real run, never written from memory: a fixture that doesn't reproduce
 * the documented output is worse than no fixture at all. */
export const fixtureSchema = z.object({
  /** Filename as referenced in the examples, e.g. "report.txt". */
  name: z.string().min(1),
  /** One-line orientation, e.g. "40 numbered lines". Optional. */
  note: z.string().optional(),
  content: z.string().min(1),
  /** The command that reproduces `content` inside the sandbox, defaulting to
   * `cat <name>`. Set it when the block isn't one file's contents — a directory tree
   * shown as `ls -lAR projects`, or a placeholder standing in for a duplicate file.
   * `scripts/verify-examples.mjs` runs it and diffs, so a fixture that has drifted from
   * its setup script fails the replay instead of quietly misleading a reader. Never
   * rendered: it exists only to keep the rendered block honest. */
  from: z.string().optional(),
});
export type Fixture = z.infer<typeof fixtureSchema>;

export const examplesFileSchema = z.object({
  command: z.string().min(1),
  fixtures: z.array(fixtureSchema).optional(),
  sections: z.array(exampleSectionSchema).min(1, "examples.yaml needs at least one section"),
});
export type ExamplesFile = z.infer<typeof examplesFileSchema>;

export const tagRegistrySchema = z.object({
  tags: z
    .array(z.object({ name: z.string().min(1), description: z.string().min(1) }))
    .min(1),
});
export type TagRegistry = z.infer<typeof tagRegistrySchema>;
