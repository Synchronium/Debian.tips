import type { Category } from "./content/schema.js";

export const SITE = {
  url: "https://debian.tips",
  title: "debian.tips",
  tagline: "Linux tips & tricks",
  description: "Practical Linux and Debian tips, tricks, and command references.",
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
 * so pages can be regrouped without touching content. See PLAN-CONTENT.md §2.1/§5.1. */
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

/** Hand-picked homepage "Start here" links, by URL. Missing pages are skipped. */
export const FEATURED_PATHS: string[] = [
  "/commands/grep/",
  "/concepts/pipes-and-redirection/",
  "/scripting/variables-and-quoting/",
  "/recipes/find-the-largest-files/",
  "/debian/apt-essentials/",
];
