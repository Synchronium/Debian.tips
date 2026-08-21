import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { PUBLIC_DIR, STYLES_DIR } from "./paths.js";

/** Minified with a source map alongside, for both the stylesheet and the static scripts.
 *
 *  The saving is real and mostly comments: this project's CSS explains its own cascade at
 *  length, which belongs in `styles/site.css` and not on the wire. 27.4K to 16.5K raw, 6.5K to
 *  3.6K gzipped, on every first visit.
 *
 *  The map is a separate file, so it costs a visitor nothing — a browser fetches it only when
 *  devtools are open — and it is what keeps the served file debuggable in the browser despite
 *  being unreadable.
 *
 *  Deliberately not applied to the HTML. Post-gzip the saving is small, and a minifier that
 *  collapses whitespace would join the lines inside `<pre>`, which is where every documented
 *  output on the site lives. Nothing would catch it: the replay compares examples.yaml against
 *  the sandbox, never the rendered page. */
/** How each kind of asset spells a source-map reference. Also the set of loaders this file
 *  handles, so the two cannot disagree. */
const SOURCE_MAP_COMMENT = {
  css: (mapFile: string) => `/*# sourceMappingURL=${mapFile} */`,
  js: (mapFile: string) => `//# sourceMappingURL=${mapFile}`,
} as const;
type AssetLoader = keyof typeof SOURCE_MAP_COMMENT;

function minify(source: string, filename: string, loader: AssetLoader): { code: string; map: string } {
  const result = transformSync(source, {
    loader,
    minify: true,
    sourcefile: filename,
    sourcemap: true,
  });
  return { code: result.code, map: result.map };
}

/** Writes a minified file and its map, returning the bytes that will be served.
 *
 *  The `sourceMappingURL` esbuild emits names the file it was given; the served file is
 *  content-hashed, so the comment is rewritten to point at the name it actually has. Getting
 *  this wrong costs nothing at runtime and silently breaks devtools, which is the kind of thing
 *  nobody notices for a year. */
function writeMinified(
  dir: string,
  filename: string,
  built: { code: string; map: string },
  loader: AssetLoader,
): string {
  const { code, map } = built;
  const body = code.replace(/\/\/# sourceMappingURL=.*$/m, "").trimEnd();
  const withMapUrl = `${body}\n${SOURCE_MAP_COMMENT[loader](`${filename}.map`)}\n`;
  writeFileSync(join(dir, filename), withMapUrl, "utf-8");
  writeFileSync(join(dir, `${filename}.map`), map, "utf-8");
  return withMapUrl;
}

export function copyPublic(distDir: string): void {
  cpSync(PUBLIC_DIR, distDir, { recursive: true });

  // public/ is copied verbatim first, then its scripts are replaced with minified builds.
  // Copying and then overwriting, rather than filtering the copy, keeps every other static
  // file — CNAME, the favicon, .nojekyll — on the one path that has always handled them.
  const assetsDir = join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  for (const script of ["search.js"]) {
    const source = readFileSync(join(PUBLIC_DIR, "assets", script), "utf-8");
    writeMinified(assetsDir, script, minify(source, script, "js"), "js");
  }
}

/** Copies styles/site.css into dist/assets/site.<hash8>.css and returns its href.
 *
 *  `extraCss` is appended before hashing: the syntax-highlighting classes are cut from the
 *  rendered pages, so they only exist once the content has been rendered, and the hash has to
 *  cover them or a stale cached stylesheet would leave a page's code blocks uncoloured.
 *
 *  The hash is taken over the *minified* bytes, which are what gets served — hashing the source
 *  instead would leave the URL unchanged when only the minifier's output moved. */
export function writeHashedCss(distDir: string, extraCss = ""): string {
  const base = readFileSync(join(STYLES_DIR, "site.css"), "utf-8");
  const source = extraCss
    ? `${base}\n/* Syntax highlighting, generated from the content. */\n${extraCss}\n`
    : base;

  // Named `site.css` in the map rather than the hashed output name, so devtools labels the
  // original something that means "the source" and not "the minified file".
  const built = minify(source, "site.css", "css");
  const hash = createHash("sha256").update(built.code).digest("hex").slice(0, 8);
  const filename = `site.${hash}.css`;
  const assetsDir = join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  writeMinified(assetsDir, filename, built, "css");
  return `/assets/${filename}`;
}
