import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeStringify from "rehype-stringify";
import { type Highlighter, type BundledLanguage, bundledLanguages, createHighlighter } from "shiki";
import { extractShikiStyles } from "./shikiStyles.js";

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
 * WCAG AA (4.5:1) against this site's light `--bg-inset` (#f0f1f4), verified
 * with pa11y-ci, 4.05:1 and 4.26:1 respectively. Swap in darker equivalents
 * (the comment colour reuses the site's own --text-muted value) after Shiki
 * renders, rather than forking the whole theme for two tokens. Dark-theme
 * colours (--shiki-dark) are untouched; they already pass.
 *
 * Anchored to the `color:` declaration on purpose. Shiki emits the light colour
 * as `style="color:#D73A49;--shiki-dark:#FF7B72"` while the highlighted code
 * itself sits in the element's text, so an unanchored replace would also rewrite
 * a literal `#D73A49` appearing *inside* a code sample, silently publishing
 * output that no longer matches what the command actually printed. */
const LIGHT_CONTRAST_FIXES: [RegExp, string][] = [
  [/color:#D73A49/g, "color:#B31D28"],
  [/color:#6A737D/g, "color:#5B6572"],
];

function fixLightThemeContrast(html: string): string {
  return LIGHT_CONTRAST_FIXES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), html);
}

/** Everything done to Shiki's output before it reaches a page: the contrast repair above, then
 *  lifting the per-token inline styles into shared classes. Order matters: the repair rewrites
 *  colours in the style declarations, which is where the classes are cut from. */
function finishShiki(html: string): string {
  return extractShikiStyles(fixLightThemeContrast(html));
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
  return finishShiki(highlighter.codeToHtml(code, { lang: resolveLang(lang), themes: THEMES }));
}

/* The `any`s below are deliberate and confined to this file's AST plumbing.
 *
 * These plugins walk and mutate mdast/hast trees in place, turning code nodes into raw
 * html nodes and rewriting blockquotes into asides, which the published `Node` types
 * model as tagged unions that don't narrow usefully across a generic recursive walk.
 * Typing it properly means taking `@types/mdast` and `@types/hast` as direct
 * dependencies and rewriting both custom plugins against `unist-util-visit`; that's a
 * real refactor of working, test-covered logic rather than an annotation pass, so it's
 * a deliberate deferral, not an oversight. The rest of the codebase is strict
 * (noUncheckedIndexedAccess, exactOptionalPropertyTypes) and should stay that way, so
 * don't take these as licence to use `any` elsewhere.
 */

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

/** What a fenced block is, announced to a screen reader that cannot see the styling.
 *
 *  Three kinds, because two were not enough. A bare fence is output, which is why
 *  `src/content/proseBlocks.ts` pairs one to the command above it; a `bash` fence is a command.
 *  Anything else is a file in that format, and calling a `.sources` stanza a command told a
 *  reader to run it. */
function blockLabel(lang: BundledLanguage | "plaintext"): string {
  if (lang === "plaintext") return "output";
  return lang === "bash" ? "command" : `${lang} file`;
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
      const rendered = finishShiki(highlighter.codeToHtml(node.value, { lang, themes: THEMES }));
      const withA11y = rendered.replace(/^<pre /, `<pre aria-label="${blockLabel(lang)}" `);
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

/* Short prose fields (an example's `description`, a section's `intro`, a fixture's `note`)
 * are authored as markdown (backticked flags, the occasional `[link](/path/)`, emphasis) and
 * rendered through the same remark parser as page prose, so there is one set of markdown rules
 * on the site rather than a second hand-rolled one.
 *
 * Deliberately *without* `allowDangerousHtml`: a stray `<tag>` in one of these fields is dropped
 * rather than injected. Nothing in content/ needs raw HTML here, and these strings land inside
 * a <p>. */
const inlineProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify)
  .freeze();

/** Renders one short field as inline markdown, with no wrapping <p>.
 *
 * `context` only ever appears in the error message, so name the field the way an
 * author would recognise it ('example "Sort by score"'). */
export async function renderInline(source: string, context: string): Promise<string> {
  if (source.trim() === "") return "";

  // Parsed and validated as mdast before rendering: these fields are single
  // sentences by contract, and a stray blank line or leading "- " would otherwise
  // emit block elements inside a <p>, which is invalid HTML the linkchecker
  // wouldn't catch. Fail the build with the offending text instead.
  const mdast = inlineProcessor.parse(source) as any;
  const [only] = mdast.children;
  if (mdast.children.length !== 1 || only?.type !== "paragraph") {
    throw new Error(
      `${context}: must be a single paragraph of inline markdown (code spans, links, emphasis), but got block-level content. Text: ${JSON.stringify(source)}`,
    );
  }

  const hast = (await inlineProcessor.run(mdast)) as any;
  const paragraph = hast.children.find((child: any) => child.type === "element" && child.tagName === "p");
  hast.children = paragraph ? paragraph.children : [];
  return String(inlineProcessor.stringify(hast));
}

/** The page pipeline, frozen once like `inlineProcessor` above. Every page on the site goes through
 *  it, and the dev server rebuilds on every save, so assembling the plugins is worth doing once.
 *
 *  Freezing it requires the table of contents to be read off the finished tree rather than
 *  collected by a plugin closing over a per-call array, which is why `renderMarkdown` below runs
 *  the pipeline in halves instead of calling `process`. Keep `collectHeadings` a pure function of
 *  the tree and this stays hoistable. */
const pageProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkShiki)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: "wrap", properties: { className: ["heading-link"] } })
  .use(calloutsPlugin)
  .use(rehypeStringify, { allowDangerousHtml: true })
  .freeze();

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  // `run` applies every transform, which is where the headings gain the ids `rehypeSlug` gives
  // them, so the tree is only worth reading for a table of contents after this and not before.
  const tree = (await pageProcessor.run(pageProcessor.parse(source) as any)) as any;
  return { html: String(pageProcessor.stringify(tree)), toc: collectHeadings(tree) };
}
