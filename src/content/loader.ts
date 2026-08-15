import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import {
  CATEGORIES,
  type Category,
  type CommandFrontmatter,
  type ExamplesFile,
  type Frontmatter,
  type ScriptingFrontmatter,
  examplesFileSchema,
  frontmatterSchema,
  tagRegistrySchema,
} from "./schema.js";
import { type TocEntry, renderMarkdown } from "./markdown.js";

export class ContentError extends Error {}

export interface TagInfo {
  name: string;
  description: string;
}

export interface PageLink {
  url: string;
  title: string;
}

export interface Page {
  slug: string;
  category: Category;
  url: string;
  title: string;
  description: string;
  tags: string[];
  updated: Date;
  related: string[];
  relatedLinks: PageLink[];
  draft: boolean;
  html: string;
  toc: TocEntry[];
  tagline?: string;
  tier?: CommandFrontmatter["tier"];
  order?: number;
  examples?: ExamplesFile;
  prev?: PageLink;
  next?: PageLink;
}

export interface ContentModel {
  pages: Page[];
  tags: TagInfo[];
}

interface RawEntry {
  slug: string;
  category: Category;
  data: Frontmatter;
  body: string;
  file: string;
  examples?: ExamplesFile;
}

function defaultContentDir(): string {
  return join(fileURLToPath(new URL("../..", import.meta.url)), "content");
}

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function urlFor(category: Category, slug: string): string {
  return `/${category}/${slug}/`;
}

function loadTagRegistry(contentDir: string): Map<string, TagInfo> {
  const file = join(contentDir, "tags.yaml");
  const parsedYaml = parseYaml(readFileSync(file, "utf-8"));
  const parsed = tagRegistrySchema.safeParse(parsedYaml);
  if (!parsed.success) {
    throw new ContentError(`content/tags.yaml is invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  return new Map(parsed.data.tags.map((t) => [t.name, t]));
}

function parseFrontmatterFile(filePath: string): { data: Frontmatter; body: string } {
  const raw = readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new ContentError(
      `${filePath}: invalid frontmatter — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return { data: parsed.data, body: content };
}

function loadFlatCategory(category: Category, contentDir: string): RawEntry[] {
  const dir = join(contentDir, category);
  if (!existsSync(dir)) return [];
  const out: RawEntry[] = [];
  for (const filename of readdirSync(dir)) {
    if (!filename.endsWith(".md")) continue;
    const file = join(dir, filename);
    const { data, body } = parseFrontmatterFile(file);
    if (data.category !== category) {
      throw new ContentError(`${file}: frontmatter category "${data.category}" does not match directory "${category}"`);
    }
    out.push({ slug: filename.replace(/\.md$/, ""), category, data, body, file });
  }
  return out;
}

function loadCommands(contentDir: string): RawEntry[] {
  const dir = join(contentDir, "commands");
  if (!existsSync(dir)) return [];
  const out: RawEntry[] = [];
  for (const slug of readdirSync(dir)) {
    const subdir = join(dir, slug);
    if (!statSync(subdir).isDirectory()) continue;

    const indexFile = join(subdir, "index.md");
    const examplesFile = join(subdir, "examples.yaml");
    if (!existsSync(indexFile)) throw new ContentError(`content/commands/${slug}/ is missing index.md`);
    if (!existsSync(examplesFile)) throw new ContentError(`content/commands/${slug}/ is missing examples.yaml`);

    const { data, body } = parseFrontmatterFile(indexFile);
    if (data.category !== "commands") {
      throw new ContentError(`${indexFile}: frontmatter category "${data.category}" does not match directory "commands"`);
    }

    const examplesYaml = parseYaml(readFileSync(examplesFile, "utf-8"));
    const examplesParsed = examplesFileSchema.safeParse(examplesYaml);
    if (!examplesParsed.success) {
      throw new ContentError(
        `${examplesFile}: invalid — ${examplesParsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }
    if (examplesParsed.data.command !== slug) {
      throw new ContentError(`${examplesFile}: command "${examplesParsed.data.command}" does not match directory "${slug}"`);
    }

    out.push({ slug, category: "commands", data, body, file: indexFile, examples: examplesParsed.data });
  }
  return out;
}

/** `readdirSync` order isn't guaranteed alphabetical or otherwise stable, so every
 * category needs an explicit sort: scripting lessons must read in course order
 * (`order`), everything else sorts by slug for a deterministic, filesystem-independent
 * listing order. */
function sortEntries(category: Category, entries: RawEntry[]): RawEntry[] {
  if (category === "scripting") {
    return [...entries].sort(
      (a, b) => (a.data as ScriptingFrontmatter).order - (b.data as ScriptingFrontmatter).order,
    );
  }
  return [...entries].sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function loadContent(contentDir: string = defaultContentDir()): Promise<ContentModel> {
  const tagRegistry = loadTagRegistry(contentDir);

  const raw: RawEntry[] = [];
  for (const category of CATEGORIES) {
    const entries = category === "commands" ? loadCommands(contentDir) : loadFlatCategory(category, contentDir);
    raw.push(...sortEntries(category, entries));
  }

  // Validation below runs against *every* page, drafts included, so `npm run check`
  // reports the same errors whether or not NODE_ENV=production is set. Validating
  // only the production-visible subset used to mean a draft could hide a real
  // problem locally (or, worse, that CI failed on content that passed locally).
  // Drafts are excluded from `pages` further down — that part is still env-dependent
  // by design, so drafts render in dev and are dropped from production builds.
  const slugFiles = new Map<string, string[]>();
  for (const entry of raw) {
    slugFiles.set(entry.slug, [...(slugFiles.get(entry.slug) ?? []), entry.file]);
  }
  for (const [slug, files] of slugFiles) {
    if (files.length > 1) {
      throw new ContentError(
        `slug "${slug}" is used by more than one page (${files.join(", ")}) — slugs must be unique across categories since related: links and tag pages address pages by slug alone`,
      );
    }
  }

  for (const entry of raw) {
    for (const tag of entry.data.tags) {
      if (!tagRegistry.has(tag)) {
        throw new ContentError(`${entry.file}: unknown tag "${tag}" — add it to content/tags.yaml first`);
      }
    }
    for (const section of entry.examples?.sections ?? []) {
      for (const example of section.examples) {
        for (const tag of example.tags ?? []) {
          if (!tagRegistry.has(tag)) {
            throw new ContentError(`${entry.file}: unknown example tag "${tag}" — add it to content/tags.yaml first`);
          }
        }
      }
    }
  }

  const seenOrders = new Map<number, string>();
  for (const entry of raw) {
    if (entry.category !== "scripting") continue;
    const order = (entry.data as ScriptingFrontmatter).order;
    const existing = seenOrders.get(order);
    if (existing) throw new ContentError(`${entry.file}: duplicate scripting order ${order} (also used by ${existing})`);
    seenOrders.set(order, entry.file);
  }

  const entryBySlug = new Map(raw.map((e) => [e.slug, e]));
  for (const entry of raw) {
    for (const rel of entry.data.related ?? []) {
      const target = entryBySlug.get(rel);
      if (!target) throw new ContentError(`${entry.file}: related slug "${rel}" does not exist`);
      // A published page linking to a draft would 404 in production, where the draft
      // isn't emitted. Caught here rather than only under NODE_ENV=production, so it
      // surfaces in dev instead of first failing in CI.
      if (!entry.data.draft && target.data.draft) {
        throw new ContentError(
          `${entry.file}: related slug "${rel}" is a draft (${target.file}) — a published page can't link to a page that production builds don't emit`,
        );
      }
    }
  }

  const visible = isProduction() ? raw.filter((e) => !e.data.draft) : raw;

  const rendered = await Promise.all(
    visible.map(async (entry) => ({ entry, ...(await renderMarkdown(entry.body)) })),
  );

  const pages: Page[] = rendered.map(({ entry, html, toc }) => {
    const page: Page = {
      slug: entry.slug,
      category: entry.category,
      url: urlFor(entry.category, entry.slug),
      title: entry.data.title,
      description: entry.data.description,
      tags: entry.data.tags,
      updated: entry.data.updated,
      related: entry.data.related ?? [],
      relatedLinks: [],
      draft: entry.data.draft ?? false,
      html,
      toc,
    };
    if (entry.category === "commands") {
      const d = entry.data as CommandFrontmatter;
      page.tagline = d.tagline;
      page.tier = d.tier;
      page.examples = entry.examples!;
    } else if (entry.category === "scripting") {
      page.order = (entry.data as ScriptingFrontmatter).order;
    }
    return page;
  });

  const pageBySlug = new Map(pages.map((p) => [p.slug, p]));
  for (const page of pages) {
    page.relatedLinks = page.related.map((slug) => {
      const target = pageBySlug.get(slug)!;
      return { url: target.url, title: target.title };
    });
  }

  const scripting = pages.filter((p) => p.category === "scripting").sort((a, b) => a.order! - b.order!);
  scripting.forEach((p, i) => {
    const previous = scripting[i - 1];
    const next = scripting[i + 1];
    if (previous) p.prev = { url: previous.url, title: previous.title };
    if (next) p.next = { url: next.url, title: next.title };
  });

  return { pages, tags: [...tagRegistry.values()] };
}
