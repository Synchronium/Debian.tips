import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeStringify from "rehype-stringify";
import { type Highlighter, type BundledLanguage, bundledLanguages, createHighlighter } from "shiki";

export interface TocEntry {
  level: 2 | 3;
  id: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
}

const THEMES = { dark: "github-dark-default", light: "github-light" } as const;

// Languages we author content in. `sed` has no Shiki grammar; sed one-liners
// are shell invocations anyway, so they fall back to bash highlighting.
const LANG_ALIASES: Record<string, BundledLanguage | "plaintext"> = { sed: "bash" };
const LOAD_LANGS: BundledLanguage[] = ["bash", "yaml", "json", "ini", "awk", "diff"];

/** `github-light`'s keyword-red (#D73A49) and comment-gray (#6A737D) both fail
 * WCAG AA (4.5:1) against this site's light `--bg-inset` (#f0f1f4) — verified
 * with pa11y-ci, 4.05:1 and 4.26:1 respectively. Swap in darker equivalents
 * (the comment colour reuses the site's own --text-muted value) after Shiki
 * renders, rather than forking the whole theme for two tokens. Dark-theme
 * colours (--shiki-dark) are untouched; they already pass. */
const LIGHT_CONTRAST_FIXES: [RegExp, string][] = [
  [/#D73A49/g, "#B31D28"],
  [/#6A737D/g, "#5B6572"],
];

function fixLightThemeContrast(html: string): string {
  return LIGHT_CONTRAST_FIXES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), html);
}

let highlighterPromise: Promise<Highlighter> | undefined;
function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({ themes: [THEMES.dark, THEMES.light], langs: LOAD_LANGS });
  return highlighterPromise;
}

function resolveLang(requested: string | null | undefined): BundledLanguage | "plaintext" {
  if (!requested) return "plaintext";
  const aliased = LANG_ALIASES[requested] ?? requested;
  return aliased in bundledLanguages ? (aliased as BundledLanguage) : "plaintext";
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter();
  return fixLightThemeContrast(highlighter.codeToHtml(code, { lang: resolveLang(lang), themes: THEMES }));
}

function walk(node: any, visit: (n: any) => void): void {
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, visit);
  }
}

function textContent(node: any): string {
  if (node.type === "text") return node.value as string;
  if (!Array.isArray(node.children)) return "";
  return node.children.map(textContent).join("");
}

/** Highlights fenced code blocks at the mdast stage, replacing them with a
 * trusted raw HTML node carrying Shiki's dual-theme output. */
function remarkShiki() {
  return async (tree: any): Promise<void> => {
    const highlighter = await getHighlighter();
    const codeNodes: any[] = [];
    walk(tree, (n) => {
      if (n.type === "code") codeNodes.push(n);
    });
    for (const node of codeNodes) {
      const lang = resolveLang(node.lang);
      const isOutput = lang === "plaintext";
      const rendered = fixLightThemeContrast(highlighter.codeToHtml(node.value, { lang, themes: THEMES }));
      const withA11y = rendered.replace(
        /^<pre /,
        `<pre aria-label="${isOutput ? "output" : "command"}" `,
      );
      node.type = "html";
      node.value = withA11y;
      delete node.lang;
      delete node.meta;
    }
  };
}

const CALLOUT_KINDS = ["NOTE", "TIP", "WARNING", "DANGER"] as const;
const CALLOUT_RE = new RegExp(`^\\[!(${CALLOUT_KINDS.join("|")})\\]\\s*`);
const CALLOUT_LABEL: Record<(typeof CALLOUT_KINDS)[number], string> = {
  NOTE: "Note",
  TIP: "Tip",
  WARNING: "Warning",
  DANGER: "Danger",
};

/** Rewrites `> [!NOTE] ...` style blockquotes into `<aside class="callout ...">` elements. */
function transformCallouts(node: any): any {
  if (Array.isArray(node.children)) {
    node.children = node.children.map(transformCallouts);
  }
  if (node.type === "element" && node.tagName === "blockquote") {
    const meaningful = node.children.filter((c: any) => !(c.type === "text" && /^\s*$/.test(c.value)));
    const [first, ...rest] = meaningful;
    if (first?.type === "element" && first.tagName === "p") {
      const firstText = first.children[0];
      const match = firstText?.type === "text" ? CALLOUT_RE.exec(firstText.value) : null;
      if (match) {
        const kind = match[1] as (typeof CALLOUT_KINDS)[number];
        firstText.value = firstText.value.slice(match[0].length);
        const bodyChildren = firstText.value === "" ? first.children.slice(1) : first.children;
        const label = {
          type: "element",
          tagName: "p",
          properties: { className: ["callout-label"] },
          children: [{ type: "text", value: CALLOUT_LABEL[kind] }],
        };
        return {
          type: "element",
          tagName: "aside",
          properties: { className: ["callout", `callout-${kind.toLowerCase()}`] },
          children: [label, { ...first, children: bodyChildren }, ...rest],
        };
      }
    }
  }
  return node;
}

function calloutsPlugin() {
  return (tree: any): void => {
    transformCallouts(tree);
  };
}

function collectHeadings(tree: any): TocEntry[] {
  const toc: TocEntry[] = [];
  walk(tree, (n) => {
    if (n.type === "element" && (n.tagName === "h2" || n.tagName === "h3")) {
      const id = n.properties?.id as string | undefined;
      if (id) toc.push({ level: n.tagName === "h2" ? 2 : 3, id, text: textContent(n) });
    }
  });
  return toc;
}

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const toc: TocEntry[] = [];

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkShiki)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap", properties: { className: ["heading-link"] } })
    .use(calloutsPlugin)
    .use(() => (tree: any) => {
      toc.push(...collectHeadings(tree));
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(source);

  return { html: String(file), toc };
}
