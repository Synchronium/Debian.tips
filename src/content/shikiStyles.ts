// Turns Shiki's per-token inline styles into shared classes.
//
// Shiki emits every highlighted token as `<span style="color:#005CC5;--shiki-dark:#79C0FF">`,
// which is about 45 bytes per token repeated hundreds of times per page — the awk page reached
// 154 KB of HTML, nearly all of it these five distinct declarations written out again and again.
// The declarations move into the stylesheet, one class each, and the markup keeps a six-character
// class name.
//
// The whole site uses a handful of distinct styles (a theme has a fixed palette, and a page uses
// a fraction of it), so the stylesheet grows by a few hundred bytes and every page shrinks.
import { createHash } from "node:crypto";

/** style declarations -> class name, and back. Both directions are kept so a hash collision is
 *  caught rather than silently merging two colours into one. */
const classByStyle = new Map<string, string>();
const styleByClass = new Map<string, string>();

/** Anchored to `--shiki-dark`, the custom property Shiki uses to carry the second theme. Only
 *  Shiki emits that, so nothing else on the page can be caught by this — and the site emits no
 *  other inline styles at all. */
const SHIKI_ELEMENT = /<(pre|span|code)\b([^>]*)>/g;
const SHIKI_STYLE = /\sstyle="([^"]*--shiki-dark[^"]*)"/;

function classFor(style: string): string {
  const existing = classByStyle.get(style);
  if (existing) return existing;

  const name = `s${createHash("sha256").update(style).digest("hex").slice(0, 6)}`;
  const clash = styleByClass.get(name);
  if (clash !== undefined && clash !== style) {
    throw new Error(`shiki class ${name} would mean two different styles: ${JSON.stringify([clash, style])}`);
  }
  classByStyle.set(style, name);
  styleByClass.set(name, style);
  return name;
}

/** Rewrites one block of Shiki output, returning markup with classes in place of inline styles.
 *  The class is appended to whatever class attribute the element already has — `<pre>` carries
 *  Shiki's own `shiki shiki-themes …`, which styles/site.css matches on. */
export function extractShikiStyles(html: string): string {
  return html.replace(SHIKI_ELEMENT, (tag, tagName: string, attrs: string) => {
    const style = SHIKI_STYLE.exec(attrs);
    if (!style?.[1]) return tag;

    const className = classFor(style[1]);
    const withoutStyle = attrs.replace(SHIKI_STYLE, "");
    const merged = /\sclass="([^"]*)"/.test(withoutStyle)
      ? withoutStyle.replace(/\sclass="([^"]*)"/, (_all, existing: string) => ` class="${existing} ${className}"`)
      : `${withoutStyle} class="${className}"`;
    return `<${tagName}${merged}>`;
  });
}

/** The CSS for every style seen so far, sorted by class name so the same content always produces
 *  the same stylesheet — the file is content-hashed, and a set iterated in insertion order would
 *  change its hash whenever pages were built in a different order. */
export function shikiStyleCss(): string {
  return [...styleByClass]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([className, style]) => `.${className}{${style}}`)
    .join("\n");
}

/** Forgets every style seen. Called at the start of a build so a colour that no content uses any
 *  more cannot survive in the stylesheet of a long-lived process — which the dev server is. */
export function resetShikiStyles(): void {
  classByStyle.clear();
  styleByClass.clear();
}
