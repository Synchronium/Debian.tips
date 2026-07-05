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
  level: z.enum(LEVELS),
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

export const examplesFileSchema = z.object({
  command: z.string().min(1),
  sections: z.array(exampleSectionSchema).min(1, "examples.yaml needs at least one section"),
});
export type ExamplesFile = z.infer<typeof examplesFileSchema>;

export const tagRegistrySchema = z.object({
  tags: z
    .array(z.object({ name: z.string().min(1), description: z.string().min(1) }))
    .min(1),
});
export type TagRegistry = z.infer<typeof tagRegistrySchema>;
