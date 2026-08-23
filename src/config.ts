import type { Category } from "./content/schema.js";
import { FEED_FILE, NOT_FOUND_FILE } from "./paths.js";
// Type only, and it has to stay that way: configuration is read by the templates, so a value
// imported back from one would point the dependency in both directions at once. The type is
// erased at compile time and the sprite stays the one place an icon exists.
import type { IconName } from "./templates/partials/icons.js";

export const SITE = {
  url: "https://debian.tips",
  title: "debian.tips",
  tagline: "Linux tips & tricks",
  description: "Practical Linux and Debian tips, tricks, and command references.",
  gaMeasurementId: "G-CFE8GTL7E4",
  /** The public repository, with no trailing slash. Every page links into it, and so do the
   *  footer and the about page. `blobUrl` below is the only sanctioned way to turn a repository
   *  path into a link. */
  repo: "https://github.com/Synchronium/Debian.tips",
} as const;

/** A link to one file in the repository, on the default branch. `path` is relative to the
 *  repository root and uses forward slashes. `pageSources` in `src/content/sourcePaths.ts` is
 *  what produces them. */
export const blobUrl = (path: string): string => `${SITE.repo}/blob/main/${path}`;

/** The routes that are not a category listing. `CATEGORY_META` below covers those; these are the
 *  rest, and each is linked from more than one template. */
export const TAGS_PATH = "/tags/";
export const FEED_PATH = `/${FEED_FILE}`;
export const NOT_FOUND_PATH = `/${NOT_FOUND_FILE}`;
export const tagPath = (tag: string): string => `${TAGS_PATH}${tag}/`;

/** Editorial order for the homepage, the footer and the sitemap. Deliberately *not* derived
 *  from `CATEGORIES`: validation order and reading order are different questions, and this list
 *  is free to lead with whatever the site most wants read first. */
export const NAV_ORDER: Category[] = [
  "commands",
  "concepts",
  "scripting",
  "recipes",
  "troubleshooting",
  "compare",
  "debian",
];

export const CATEGORY_META: Record<Category, { label: string; path: string; description: string }> = {
  commands: {
    label: "Commands",
    path: "/commands/",
    description: "Command references with practical, copy-pasteable examples.",
  },
  concepts: {
    label: "Concepts",
    path: "/concepts/",
    description: "How core Linux fundamentals actually work.",
  },
  scripting: {
    label: "Scripting",
    path: "/scripting/",
    description: "A guided course in bash scripting, one lesson at a time.",
  },
  recipes: {
    label: "Recipes",
    path: "/recipes/",
    description: "Short, task-oriented how-tos: problem, solution, explanation.",
  },
  troubleshooting: {
    label: "Troubleshooting",
    path: "/troubleshooting/",
    description: "Named after the error you were given: what it means, and what to do about it.",
  },
  compare: {
    label: "Compare",
    path: "/compare/",
    description: "Two tools that overlap, what differs between them, and which one to use.",
  },
  debian: {
    label: "Debian",
    path: "/debian/",
    description: "Debian-specific package management and administration.",
  },
};

/** The header's nav, which stays three items wide however many categories exist.
 *
 *  A header that grows a link per category runs out of room at seven and wraps to a second line
 *  at eight, and `--header-height` in styles/site.css is a measured constant that every anchor
 *  jump on the site depends on. Grouping keeps the next category from being a layout problem: it
 *  joins a group here and the header does not move.
 *
 *  A group with one category is a plain link; a group with several is a menu. Every category
 *  belongs to exactly one group, so nothing is reachable only by search, and
 *  `test/categories.test.ts` fails if one is left out. */
export interface NavGroup {
  label: string;
  path: string;
  categories: Category[];
}
export const NAV_GROUPS: NavGroup[] = [
  { label: "Commands", path: CATEGORY_META.commands.path, categories: ["commands"] },
  {
    label: "Guides",
    path: CATEGORY_META.concepts.path,
    categories: ["concepts", "scripting", "recipes", "troubleshooting", "compare", "debian"],
  },
];

/** The homepage's "Browse by topic" grid.
 *
 *  This is the *subject* axis (ADR-0006), so each entry points at a tag page rather than a
 *  category listing: a reader arrives wanting "networking", not "recipes". Curated rather than
 *  generated from `content/tags.yaml`, because a homepage grid wants a fixed handful of broad
 *  doors and the registry holds tags of varying breadth, several too narrow to be one. `linkcheck`
 *  fails the build if a `tag` here has no page, so a retired tag cannot rot into a dead link.
 *
 *  `icon` names a symbol in the sprite, and `IconName` is derived from the sprite itself, so a
 *  name with no symbol behind it does not compile. */
export interface HomeTopic {
  label: string;
  description: string;
  tag: string;
  icon: IconName;
}
export const HOME_TOPICS: HomeTopic[] = [
  {
    label: "Package management",
    description: "Install, remove and manage software",
    tag: "apt",
    icon: "package",
  },
  {
    label: "System administration",
    description: "Manage users, permissions and services",
    tag: "sysadmin",
    icon: "sliders",
  },
  {
    label: "Text processing",
    description: "Filter, transform and reshape text",
    tag: "text-processing",
    icon: "text",
  },
  {
    label: "Files & directories",
    description: "Work with files and permissions",
    tag: "files",
    icon: "folder",
  },
  { label: "Search & find", description: "Find files, text and data", tag: "search", icon: "search" },
  { label: "Networking", description: "Configure, transfer and diagnose", tag: "networking", icon: "wifi" },
  {
    label: "Processes",
    description: "Monitor and control running processes",
    tag: "processes",
    icon: "activity",
  },
  { label: "Scripting", description: "Write and debug shell scripts", tag: "scripting", icon: "terminal" },
  { label: "Security", description: "Secure a system and manage access", tag: "security", icon: "lock" },
];

/** Display grouping for /commands/: a lookup table, not per-page frontmatter,
 * so pages can be regrouped without touching content. A command page whose slug
 * isn't listed here still builds, but falls into COMMAND_GROUP_FALLBACK rather
 * than its logical section. Slugs with no page yet are ignored, so this doubles
 * as a rough roadmap of intended coverage. */
export const COMMAND_GROUPS: { title: string; commands: string[] }[] = [
  {
    title: "Debian packages",
    commands: ["apt", "dpkg", "apt-cache", "apt-file", "apt-mark", "update-alternatives", "dpkg-reconfigure"],
  },
  {
    title: "Text processing",
    commands: [
      "grep",
      "sed",
      "awk",
      "jq",
      "sort",
      "uniq",
      "cut",
      "tr",
      "head",
      "tail",
      "wc",
      "diff",
      "column-tools",
      "tee",
      "cowsay",
    ],
  },
  {
    title: "Files & directories",
    commands: ["ls", "find", "cp", "mv", "rm", "make-and-link", "inspect-files", "touch", "du", "df", "tree"],
  },
  { title: "Searching", commands: ["locate"] },
  { title: "Archives & compression", commands: ["tar", "compression-tools", "zip"] },
  {
    title: "Processes & system",
    commands: [
      "ps",
      "top-htop",
      "kill-signals",
      "job-control",
      "systemctl",
      "journalctl",
      "system-at-a-glance",
    ],
  },
  {
    title: "Networking & transfer",
    commands: ["curl", "wget", "ssh", "rsync", "dig", "ip", "ss", "ping-traceroute", "nc"],
  },
  { title: "Users & permissions", commands: ["chmod", "chown", "sudo", "managing-users"] },
  {
    title: "Shell & automation",
    commands: ["xargs", "watch", "crontab", "date", "env-export", "history", "alias"],
  },
];
export const COMMAND_GROUP_FALLBACK = "More commands";

/** Pages that belong to no category: no listing to appear on, no tags, no prev/next. They are
 *  built straight from a Markdown file in `content/` and reached from the header and footer.
 *
 *  Listed here because a standalone page is otherwise spelled out in five unrelated places
 *  (the builder, the sitemap, two templates and the link audit's orphan exemption), and missing
 *  the last of those would report the new page as an orphan for ever, with no way to fix it,
 *  since nothing in `content/` is meant to link it.
 *
 *  `navLabel` is the wording used in links to the page, and is free to differ from the page's
 *  own title: a footer has less room than a heading. `headerLabel` is shorter again, because the
 *  header has to hold every nav item on one line at every width, and is the one place where a
 *  label that reads as a category ("About") beats one that describes the page. */
export interface StandalonePage {
  path: string;
  source: string;
  navLabel: string;
  headerLabel: string;
}
export const STANDALONE_PAGES: StandalonePage[] = [
  { path: "/about/", source: "about.md", navLabel: "How this site is tested", headerLabel: "About" },
];

/** Hand-picked homepage "Start here" links, by URL. Missing pages are skipped. */
export const FEATURED_PATHS: string[] = [
  "/commands/grep/",
  "/concepts/pipes-and-redirection/",
  "/scripting/variables-and-quoting/",
  "/recipes/find-the-largest-files/",
  "/debian/apt-essentials/",
];
