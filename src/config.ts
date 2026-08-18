import type { Category } from "./content/schema.js";

export const SITE = {
  url: "https://debian.tips",
  title: "debian.tips",
  tagline: "Linux tips & tricks",
  description: "Practical Linux and Debian tips, tricks, and command references.",
  gaMeasurementId: "G-CFE8GTL7E4",
} as const;

export const NAV_ORDER: Category[] = ["commands", "concepts", "scripting", "recipes", "debian"];

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
  debian: {
    label: "Debian",
    path: "/debian/",
    description: "Debian-specific package management and administration.",
  },
};

/** Display grouping for /commands/ — a lookup table, not per-page frontmatter,
 * so pages can be regrouped without touching content. A command page whose slug
 * isn't listed here still builds, but falls into COMMAND_GROUP_FALLBACK rather
 * than its logical section. Slugs with no page yet are ignored, so this doubles
 * as a rough roadmap of intended coverage. */
export const COMMAND_GROUPS: { title: string; commands: string[] }[] = [
  { title: "Text processing", commands: ["grep", "sed", "awk", "sort", "uniq", "cut", "tr", "head", "tail", "wc", "diff", "column-tools", "tee"] },
  { title: "Files & directories", commands: ["ls", "find", "cp", "mv", "rm", "make-and-link", "inspect-files", "touch", "du", "df", "tree"] },
  { title: "Searching", commands: ["locate"] },
  { title: "Archives & compression", commands: ["tar", "compression-tools", "zip"] },
  { title: "Processes & system", commands: ["ps", "top-htop", "kill-signals", "job-control", "systemctl", "journalctl", "system-at-a-glance"] },
  { title: "Networking & transfer", commands: ["curl", "wget", "ssh", "rsync", "dig", "ip", "ss", "ping-traceroute", "nc"] },
  { title: "Users & permissions", commands: ["chmod", "chown", "sudo", "managing-users"] },
  { title: "Shell & automation", commands: ["xargs", "watch", "cron", "date", "env-export", "history", "alias"] },
];
export const COMMAND_GROUP_FALLBACK = "More commands";

/** Pages that belong to no category: no listing to appear on, no tags, no prev/next. They are
 *  built straight from a Markdown file in `content/` and reached from the header and footer.
 *
 *  Listed here because a standalone page is otherwise spelled out in five unrelated places —
 *  the builder, the sitemap, two templates and the link audit's orphan exemption — and missing
 *  the last of those would report the new page as an orphan for ever, with no way to fix it,
 *  since nothing in `content/` is meant to link it.
 *
 *  `navLabel` is the wording used in links to the page, and is free to differ from the page's
 *  own title: a footer has less room than a heading. */
export interface StandalonePage {
  path: string;
  source: string;
  navLabel: string;
}
export const STANDALONE_PAGES: StandalonePage[] = [
  { path: "/about/", source: "about.md", navLabel: "How this site is tested" },
];

/** Hand-picked homepage "Start here" links, by URL. Missing pages are skipped. */
export const FEATURED_PATHS: string[] = [
  "/commands/grep/",
  "/concepts/pipes-and-redirection/",
  "/scripting/variables-and-quoting/",
  "/recipes/find-the-largest-files/",
  "/debian/apt-essentials/",
];
