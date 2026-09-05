import { z } from "zod";

/** The page *shapes* the site publishes. This is the taxonomy's primary axis and it sorts
 *  pages by how they are written and read, not by what they are about. Subject is the job of
 *  `content/tags.yaml`, which is many-to-many precisely because `rsync` is a networking command
 *  and a files command at once.
 *
 *  Each category answers to what a reader arrives with:
 *
 *    commands         a tool's name        "I know it's `xargs`, I want to use it well."
 *    concepts         a why                "But how does that actually work?"
 *    scripting        nothing yet          an ordered course; each lesson assumes the last
 *    recipes          a goal               "I want to achieve X."
 *    troubleshooting  an error message     "X broke, and here is what it printed."
 *    compare          two options          "X or Y, and nobody told me how to choose."
 *    debian           a why, about Debian  an explainer that would be wrong elsewhere
 *
 *  `recipes` and `troubleshooting` split on how the reader arrived rather than on subject:
 *  "free up disk space" is a recipe, "No space left on device" is troubleshooting, and the two
 *  are worth having separately even where the knowledge overlaps.
 *
 *  `debian` is the one category on the subject axis rather than the shape axis, which is a
 *  product decision (the site is called debian.tips) rather than a taxonomic one. It is bounded
 *  to keep it from absorbing everything Debian-flavoured: it is the Debian wing of `concepts`,
 *  and anything with a Debian subject but another shape files under that shape and takes the
 *  `debian` tag. So the apt error pages are `troubleshooting`, and `dpkg vs apt` is `compare`. */
export const CATEGORIES = [
  "commands",
  "concepts",
  "scripting",
  "recipes",
  "troubleshooting",
  "compare",
  "debian",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** The two categories the code has to name, because each carries something the others do not.
 *
 *  `commands` is a directory per page rather than a file, so it is loaded, rendered, sourced and
 *  listed differently. `scripting` is an ordered course, so it alone carries `order:` and gets
 *  prev/next links.
 *
 *  Named as constants rather than written out at each comparison, for the reason `CLAUDE.md` gives
 *  in full: a value validated in one place and re-spelled in another fails open. `Category` already
 *  stops a *typo* compiling; what it cannot stop is a category being renamed in `CATEGORIES` while
 *  a comparison against the old spelling keeps compiling and quietly takes the other branch. */
export const COMMANDS_CATEGORY = "commands" as const satisfies Category;
export const SCRIPTING_CATEGORY = "scripting" as const satisfies Category;

/** Every category except `commands`: the ones whose pages are a single Markdown file, stating
 *  their examples as fenced blocks rather than in a structured `examples.yaml`. The prose replay
 *  and the build's statistics both need this set.
 *
 *  Derived rather than listed, because a new category left out of a listed copy fails silently:
 *  its pages would never be replayed, under a total that still looked right. */
export type ProseCategory = Exclude<Category, typeof COMMANDS_CATEGORY>;
export const PROSE_CATEGORIES: readonly ProseCategory[] = CATEGORIES.filter(
  (category): category is ProseCategory => category !== COMMANDS_CATEGORY,
);

export const TIERS = ["flagship", "standard", "light"] as const;
export type Tier = (typeof TIERS)[number];

export const LEVELS = ["basic", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

/** How the replay compares one *line* of a documented output against a fresh run.
 *
 *  Here rather than beside either parser because both spellings are *authored*: a prose page
 *  writes `<!-- verify: shape … -->` above a block, a command page writes `compare: shape` on an
 *  example. Two field names, one vocabulary.
 *
 *  Whether the *order* of those lines is part of the claim is a separate axis, `unordered:` on an
 *  example. It is not a fourth mode here because the two compose, and a mode cannot be two things
 *  at once. ADR-0026. */
export const COMPARISON = {
  /** Byte for byte, after the anchored masks in `scripts/lib/normalise.ts`. The default. */
  exact: "exact",
  /** Digits, quantities, dates and identifiers masked on both sides: the numbers may move, a
   *  renamed field or a vanished line still fails. */
  shape: "shape",
  /** Not run at all. Prose pages carry the reason inline; command pages carry it in
   *  `scripts/fixtures/<slug>.skip`. */
  skip: "skip",
} as const;
export type Comparison = (typeof COMPARISON)[keyof typeof COMPARISON];

const dateSchema = z.union([z.string(), z.date()]).transform((v, ctx) => {
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid date: ${String(v)}` });
    return z.NEVER;
  }
  return d;
});

/** The one-line summary shown under a page's title.
 *
 *  Separate from `description`, which is the search-result snippet and is written for a reader
 *  who has not arrived yet: it repeats the page's subject because it has to stand alone in a
 *  result list. A tagline is read directly beneath the title it belongs to, so it says what the
 *  title cannot rather than restating it, and it is short enough not to compete with the heading.
 *
 *  Required on command pages, optional everywhere else. The length limit keeps it to one line at
 *  the width the design gives it. */
const taglineSchema = z.string().min(1).max(60, "tagline must be at most 60 characters");

const baseFrontmatter = {
  title: z.string().min(1, "title is required"),
  description: z
    .string()
    .min(50, "description must be at least 50 characters")
    .max(160, "description must be at most 160 characters"),
  tagline: taglineSchema.optional(),
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
  category: z.literal(COMMANDS_CATEGORY),
  // Required here, overriding the optional one in `baseFrontmatter`: a command page's title is a
  // command name, so without a line saying what it does the page opens with `tr` and nothing else.
  tagline: taglineSchema,
  tier: z.enum(TIERS),
});

export const scriptingFrontmatterSchema = z.object({
  ...baseFrontmatter,
  category: z.literal(SCRIPTING_CATEGORY),
  order: z.number().int().positive(),
});

export const conceptsFrontmatterSchema = z.object({ ...baseFrontmatter, category: z.literal("concepts") });
export const recipesFrontmatterSchema = z.object({ ...baseFrontmatter, category: z.literal("recipes") });
export const debianFrontmatterSchema = z.object({ ...baseFrontmatter, category: z.literal("debian") });
export const troubleshootingFrontmatterSchema = z.object({
  ...baseFrontmatter,
  category: z.literal("troubleshooting"),
});
export const compareFrontmatterSchema = z.object({ ...baseFrontmatter, category: z.literal("compare") });

export const frontmatterSchema = z.discriminatedUnion("category", [
  commandFrontmatterSchema,
  scriptingFrontmatterSchema,
  conceptsFrontmatterSchema,
  recipesFrontmatterSchema,
  troubleshootingFrontmatterSchema,
  compareFrontmatterSchema,
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
  /** Reserved, deliberately: validated and authored on every example, but no template renders
   * it yet. Kept for a future difficulty badge or filter. Don't "clean up" as dead data, and
   * keep setting it accurately when authoring, because backfilling every example later costs far
   * more than getting it right up front. `level` is conceptual difficulty, and is *not* a proxy for
   * the `beginner` tag below: plenty of `basic` examples do not carry it, and some `advanced`
   * ones do. */
  level: z.enum(LEVELS),
  /** Reserved, same as `level`: validated against content/tags.yaml so a typo still fails the
   * build, but not rendered anywhere yet. Coverage is partial, so anything built on it has to
   * handle an untagged example. */
  tags: z.array(z.string()).optional(),
  danger: z.boolean().optional(),
  /** Set when the output is real but cannot reproduce byte for byte, because it contains a
   * value from the clock, the machine, or the network: a PID, a memory figure, an elapsed
   * time. The string says what will differ, and is shown to the reader above the output; a
   * bare flag would leave them guessing which parts to distrust.
   *
   * `volatile:` says what differs; it does not by itself change how the output is checked. Most
   * volatile output is still compared exactly, because `scripts/lib/normalise.ts` masks the
   * specific line it appears on (a `diff` header's mtime, a wget transfer rate) and an
   * anchored mask is stricter than a general one. */
  volatile: z.string().min(1).optional(),
  /** How the replay compares this example's output. Omitted means exactly, after the
   * anchored masks in `scripts/lib/normalise.ts`.
   *
   * `shape` is for output carrying values no anchored mask covers: a PID, a memory
   * figure, an invocation id. Digits, quantities, dates and identifiers are masked on both
   * sides, so the numbers may move while a renamed field, a vanished line or a changed
   * state still fails. It is weaker than the default, so it is opt-in per example rather
   * than implied by `volatile`, and it requires `volatile` to be set: a reader looking at
   * output nobody promises to reproduce should be told. */
  compare: z.literal(COMPARISON.shape).optional(),
  /** Set when the command has no defined order for the lines it prints, so the page shows one
   *  order and the reader sees another. Each line must still appear as many times as the page
   *  shows it, and a vanished line, an extra one or a changed one still fails.
   *
   *  A separate axis from `compare` rather than a fourth mode of it, because the two compose:
   *  `ss -ltnp` prints a PID no mask covers, and prints its rows in an order settled per network
   *  namespace, so it needs both. Lines are compared first, then their order is discarded.
   *
   *  Only for an order outside the command's control. Where a `sort` would do, write the `sort`:
   *  it holds the page to more, and on a page about `find` or `grep -r` the reader wants it
   *  anyway. `ss` has no flag that sorts, and a listing of two sockets is most of what its page
   *  has to show.
   *
   *  Requires `volatile:` for the reason `compare: shape` does: the reader is looking at an order
   *  nobody promises to reproduce, and should be told rather than left to trust it. */
  unordered: z.boolean().optional(),
}).superRefine((example, ctx) => {
  if (example.compare === COMPARISON.shape && !example.volatile) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `compare: "${COMPARISON.shape}" needs \`volatile:\` too: say what will differ for the reader`,
    });
  }
  if (example.unordered && !example.volatile) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "`unordered: true` needs `volatile:` too: say what will differ for the reader",
    });
  }
});
export type Example = z.infer<typeof exampleSchema>;

export const exampleSectionSchema = z.object({
  title: z.string().min(1),
  intro: z.string().optional(),
  examples: z.array(exampleSchema).min(1, "each section needs at least one example"),
});
export type ExampleSection = z.infer<typeof exampleSectionSchema>;

/** The sample data an example's `output:` was actually produced against. Without it a
 * reader can't evaluate output that doesn't echo its input: `wc -l report.txt` printing
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
   * `cat <name>`. Set it when the block isn't one file's contents: a directory tree
   * shown as `ls -lAR projects`, or a placeholder standing in for a duplicate file.
   * `scripts/replay/command-page.ts` runs it and diffs, so a fixture that has drifted from
   * its setup script fails the replay instead of quietly misleading a reader. Never
   * rendered: it exists only to keep the rendered block honest. */
  from: z.string().optional(),
  /** As `unordered` on an example: the `from:` command has no defined order for the lines it
   *  prints, so the block is compared as a multiset of lines. Requires `note:`, which is where a
   *  fixture tells the reader what they are looking at, since a block carries no `volatile:`. */
  unordered: z.boolean().optional(),
}).superRefine((fixture, ctx) => {
  if (fixture.unordered && !fixture.note) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "`unordered: true` on a fixture needs `note:` too: say what will differ for the reader",
    });
  }
});
export type Fixture = z.infer<typeof fixtureSchema>;

export const examplesFileSchema = z.object({
  command: z.string().min(1),
  fixtures: z.array(fixtureSchema).optional(),
  sections: z.array(exampleSectionSchema).min(1, "examples.yaml needs at least one section"),
});
export type ExamplesFile = z.infer<typeof examplesFileSchema>;

/** A tag's name is a URL path segment. `/tags/<name>/` is a real directory in `dist/` and a
 *  real link on every page carrying it, so it is held to what a path segment may contain
 *  rather than to `min(1)`. A tag called `apt/dpkg` would write outside its own directory and
 *  link somewhere that never resolves; a tag with a space would ship a link nothing can follow.
 *  The registry is hand-edited, which is exactly why the constraint belongs in the schema. */
const tagNameSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "a tag name must be lowercase letters, digits and single hyphens");

export const tagRegistrySchema = z.object({
  tags: z.array(z.object({ name: tagNameSchema, description: z.string().min(1) })).min(1),
});
export type TagRegistry = z.infer<typeof tagRegistrySchema>;
