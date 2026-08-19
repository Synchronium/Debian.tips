import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import {
  CATEGORIES,
  type Category,
  type CommandFrontmatter,
  type ExamplesFile,
  type Frontmatter,
  type ScriptingFrontmatter,
  type Tier,
  examplesFileSchema,
  frontmatterSchema,
  tagRegistrySchema,
} from "./schema.js";
import { CONTENT_DIR, EXAMPLES_FILE, INDEX_FILE, TAGS_FILE, fixtureScript } from "../paths.js";
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

/** What every page has, whatever shape it is. */
interface BasePage {
  slug: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  updated: Date;
  /** `related:` exactly as authored — bare slugs and `category/slug` alike. Resolved forms are
   *  in `relatedLinks`; this is kept for error messages and tooling that reports on frontmatter. */
  related: string[];
  relatedLinks: PageLink[];
  draft: boolean;
  html: string;
  toc: TocEntry[];
}

/** A command reference: prose plus a structured `examples.yaml`. The examples are not optional
 *  here — `loadCommands` refuses a command directory without them — which is what lets the
 *  template take them without a runtime check. */
export interface CommandPage extends BasePage {
  category: "commands";
  tagline: string;
  tier: Tier;
  examples: ExamplesFile;
}

/** A lesson in the scripting course: ordered, and linked to its neighbours. */
export interface ScriptingPage extends BasePage {
  category: "scripting";
  order: number;
  prev?: PageLink;
  next?: PageLink;
}

/** Everything else: one Markdown file, no per-category extras. */
export interface ArticlePage extends BasePage {
  category: Exclude<Category, "commands" | "scripting">;
}

/** Modelled as a union rather than as one interface with optional `tier`/`order`/`examples`,
 *  because the optional-field version pushed the knowledge of which fields a category actually
 *  has into every consumer — seven `!` assertions and casts across the loader, the templates and
 *  the link audit, each of them a place the compiler had stopped helping. Narrowing on
 *  `page.category` now does that work. */
export type Page = CommandPage | ScriptingPage | ArticlePage;

export function isCommandPage(page: Page): page is CommandPage {
  return page.category === "commands";
}

export function isScriptingPage(page: Page): page is ScriptingPage {
  return page.category === "scripting";
}

export interface ContentModel {
  pages: Page[];
  tags: TagInfo[];
}

interface BaseEntry {
  slug: string;
  body: string;
  file: string;
}

/** Split the same way `Page` is, so the one place that knows a command directory must contain an
 *  examples.yaml — `loadCommands`, which refuses one that doesn't — is also the only place that
 *  has to say so. Leaving `examples` optional on a single entry type meant asserting it back at
 *  the point the page was built, which is the assertion this split removes. */
interface RawCommandEntry extends BaseEntry {
  category: "commands";
  data: CommandFrontmatter;
  examples: ExamplesFile;
}

interface RawScriptingEntry extends BaseEntry {
  category: "scripting";
  data: ScriptingFrontmatter;
}

interface RawArticleEntry extends BaseEntry {
  category: Exclude<Category, "commands" | "scripting">;
  data: Frontmatter;
}

/** The same three shapes `Page` has, so narrowing on `entry.category` narrows its frontmatter
 *  too. Carrying one entry type with a `Frontmatter` union meant every use site re-asserted
 *  which member it had, which is the work this split does once. */
type RawEntry = RawCommandEntry | RawScriptingEntry | RawArticleEntry;

type RawProseEntry = RawScriptingEntry | RawArticleEntry;

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function urlFor(category: Category, slug: string): string {
  return `/${category}/${slug}/`;
}

/** How a page is named in an error message and in a qualified `related:` entry. */
function qualify(category: Category, slug: string): string {
  return `${category}/${slug}`;
}

function loadTagRegistry(contentDir: string): Map<string, TagInfo> {
  const file = join(contentDir, TAGS_FILE);
  const parsedYaml = parseYaml(readFileSync(file, "utf-8"));
  const parsed = tagRegistrySchema.safeParse(parsedYaml);
  if (!parsed.success) {
    throw new ContentError(
      `content/${TAGS_FILE} is invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
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

function loadFlatCategory(category: Exclude<Category, "commands">, contentDir: string): RawProseEntry[] {
  const dir = join(contentDir, category);
  if (!existsSync(dir)) return [];
  const out: RawProseEntry[] = [];
  for (const filename of readdirSync(dir)) {
    if (!filename.endsWith(".md")) continue;
    const file = join(dir, filename);
    const { data, body } = parseFrontmatterFile(file);
    if (data.category !== category) {
      throw new ContentError(
        `${file}: frontmatter category "${data.category}" does not match directory "${category}"`,
      );
    }
    const slug = filename.replace(/\.md$/, "");
    // Switched on the frontmatter rather than on `category`: the two are checked against each
    // other above, but they are separate types, and only the frontmatter carries `order`.
    out.push(
      data.category === "scripting"
        ? { slug, category: "scripting", data, body, file }
        : { slug, category: data.category, data, body, file },
    );
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

    const indexFile = join(subdir, INDEX_FILE);
    const examplesFile = join(subdir, EXAMPLES_FILE);
    if (!existsSync(indexFile)) throw new ContentError(`content/commands/${slug}/ is missing ${INDEX_FILE}`);
    if (!existsSync(examplesFile))
      throw new ContentError(`content/commands/${slug}/ is missing ${EXAMPLES_FILE}`);

    const { data, body } = parseFrontmatterFile(indexFile);
    if (data.category !== "commands") {
      throw new ContentError(
        `${indexFile}: frontmatter category "${data.category}" does not match directory "commands"`,
      );
    }

    const examplesYaml = parseYaml(readFileSync(examplesFile, "utf-8"));
    const examplesParsed = examplesFileSchema.safeParse(examplesYaml);
    if (!examplesParsed.success) {
      throw new ContentError(
        `${examplesFile}: invalid — ${examplesParsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }
    if (examplesParsed.data.command !== slug) {
      throw new ContentError(
        `${examplesFile}: command "${examplesParsed.data.command}" does not match directory "${slug}"`,
      );
    }

    out.push({ slug, category: "commands", data, body, file: indexFile, examples: examplesParsed.data });
  }
  return out;
}

/** `readdirSync` order isn't guaranteed alphabetical or otherwise stable, so every
 * category needs an explicit sort: scripting lessons must read in course order
 * (`order`), everything else sorts by slug for a deterministic, filesystem-independent
 * listing order. */
function sortEntries(entries: RawEntry[]): RawEntry[] {
  return [...entries].sort((a, b) => {
    if (a.data.category === "scripting" && b.data.category === "scripting") {
      return a.data.order - b.data.order;
    }
    return a.slug.localeCompare(b.slug);
  });
}

/** Resolves one `related:` entry to the page it names.
 *
 *  Two spellings are accepted. `category/slug` is unambiguous and is what an author should reach
 *  for; a bare `slug` is the original spelling, kept because most of the content uses it and it
 *  reads better when there is only one page it could mean. A bare slug that matches more than one
 *  page is an error naming the qualified alternatives, rather than a silent pick. */
function resolveRelated(
  reference: string,
  byQualified: Map<string, RawEntry>,
  bySlug: Map<string, RawEntry[]>,
): { entry: RawEntry } | { error: string } {
  if (reference.includes("/")) {
    const entry = byQualified.get(reference);
    return entry ? { entry } : { error: `related page "${reference}" does not exist` };
  }
  const matches = bySlug.get(reference) ?? [];
  const [only] = matches;
  if (!only) return { error: `related slug "${reference}" does not exist` };
  if (matches.length > 1) {
    const options = matches.map((match) => qualify(match.category, match.slug)).join(", ");
    return {
      error: `related slug "${reference}" is ambiguous (${options}) — write it as "category/slug"`,
    };
  }
  return { entry: only };
}

export async function loadContent(contentDir: string = CONTENT_DIR): Promise<ContentModel> {
  const tagRegistry = loadTagRegistry(contentDir);

  const raw: RawEntry[] = [];
  for (const category of CATEGORIES) {
    const entries = category === "commands" ? loadCommands(contentDir) : loadFlatCategory(category, contentDir);
    raw.push(...sortEntries(entries));
  }

  // Validation below runs against *every* page, drafts included, so `npm run check`
  // reports the same errors whether or not NODE_ENV=production is set. Validating
  // only the production-visible subset used to mean a draft could hide a real
  // problem locally (or, worse, that CI failed on content that passed locally).
  // Drafts are excluded from `pages` further down — that part is still env-dependent
  // by design, so drafts render in dev and are dropped from production builds.
  const bySlug = new Map<string, RawEntry[]>();
  const byQualified = new Map<string, RawEntry>();
  for (const entry of raw) {
    bySlug.set(entry.slug, [...(bySlug.get(entry.slug) ?? []), entry]);
    byQualified.set(qualify(entry.category, entry.slug), entry);
  }

  // A slug no longer has to be unique across the whole site — `related:` can say which page it
  // means, and every URL is `/category/slug/` regardless. One thing still keys off the bare slug
  // and cannot: the replay looks for a page's setup script at `scripts/fixtures/<slug>.sh`, so two
  // pages sharing a slug would share a setup script, and the second would be replayed against the
  // first one's fixtures while reporting a clean run. Caught here, in the cheap gate, rather than
  // in the replay, which needs Docker.
  for (const [slug, entries] of bySlug) {
    if (entries.length > 1 && existsSync(fixtureScript(slug))) {
      throw new ContentError(
        `slug "${slug}" is used by ${entries.map((e) => e.file).join(" and ")}, and they would share ` +
          `the one setup script at scripts/fixtures/${slug}.sh — rename one of the pages`,
      );
    }
  }

  for (const entry of raw) {
    for (const tag of entry.data.tags) {
      if (!tagRegistry.has(tag)) {
        throw new ContentError(`${entry.file}: unknown tag "${tag}" — add it to content/${TAGS_FILE} first`);
      }
    }
    for (const section of entry.category === "commands" ? entry.examples.sections : []) {
      for (const example of section.examples) {
        for (const tag of example.tags ?? []) {
          if (!tagRegistry.has(tag)) {
            throw new ContentError(
              `${entry.file}: unknown example tag "${tag}" — add it to content/${TAGS_FILE} first`,
            );
          }
        }
      }
    }
  }

  const seenOrders = new Map<number, string>();
  for (const entry of raw) {
    if (entry.data.category !== "scripting") continue;
    const { order } = entry.data;
    const existing = seenOrders.get(order);
    if (existing)
      throw new ContentError(`${entry.file}: duplicate scripting order ${order} (also used by ${existing})`);
    seenOrders.set(order, entry.file);
  }

  // Resolved once, here, and reused when the links are built below — so a `related:` entry is
  // parsed by exactly one piece of code whether it is being validated or rendered.
  const relatedTargets = new Map<RawEntry, RawEntry[]>();
  for (const entry of raw) {
    const targets: RawEntry[] = [];
    for (const reference of entry.data.related ?? []) {
      const resolved = resolveRelated(reference, byQualified, bySlug);
      if ("error" in resolved) throw new ContentError(`${entry.file}: ${resolved.error}`);
      // A published page linking to a draft would 404 in production, where the draft
      // isn't emitted. Caught here rather than only under NODE_ENV=production, so it
      // surfaces in dev instead of first failing in CI.
      if (!entry.data.draft && resolved.entry.data.draft) {
        throw new ContentError(
          `${entry.file}: related page "${reference}" is a draft (${resolved.entry.file}) — a published page can't link to a page that production builds don't emit`,
        );
      }
      targets.push(resolved.entry);
    }
    relatedTargets.set(entry, targets);
  }

  const visible = isProduction() ? raw.filter((e) => !e.data.draft) : raw;

  const rendered = await Promise.all(
    visible.map(async (entry) => ({ entry, ...(await renderMarkdown(entry.body)) })),
  );

  const built = rendered.map(({ entry, html, toc }) => {
    const base = {
      slug: entry.slug,
      url: urlFor(entry.category, entry.slug),
      title: entry.data.title,
      description: entry.data.description,
      tags: entry.data.tags,
      updated: entry.data.updated,
      related: entry.data.related ?? [],
      relatedLinks: [] as PageLink[],
      draft: entry.data.draft ?? false,
      html,
      toc,
    };

    const page = ((): Page => {
      if (entry.category === "commands") {
        return {
          ...base,
          category: "commands",
          tagline: entry.data.tagline,
          tier: entry.data.tier,
          examples: entry.examples,
        };
      }
      if (entry.category === "scripting") {
        return { ...base, category: "scripting", order: entry.data.order };
      }
      return { ...base, category: entry.category };
    })();
    return { page, entry };
  });

  const pages = built.map(({ page }) => page);
  const pageByUrl = new Map(pages.map((p) => [p.url, p]));
  for (const { page, entry } of built) {
    page.relatedLinks = (relatedTargets.get(entry) ?? []).flatMap((target) => {
      // In a production build a draft target is absent from `pages`. A published page can't have
      // one (checked above), so this only drops draft→draft links, which are the ones production
      // has no page for anyway.
      const linked = pageByUrl.get(urlFor(target.category, target.slug));
      return linked ? [{ url: linked.url, title: linked.title }] : [];
    });
  }

  const scripting = pages.filter(isScriptingPage).sort((a, b) => a.order - b.order);
  scripting.forEach((p, i) => {
    const previous = scripting[i - 1];
    const next = scripting[i + 1];
    if (previous) p.prev = { url: previous.url, title: previous.title };
    if (next) p.next = { url: next.url, title: next.title };
  });

  return { pages, tags: [...tagRegistry.values()] };
}
