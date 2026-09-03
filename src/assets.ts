import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { CLIENT_DIR, FONT_FILE, FONT_SOURCE, PUBLIC_DIR, STYLES_DIR } from "./paths.js";

/** Minified with a source map alongside, for both the stylesheet and the static scripts.
 *
 *  Most of the saving is comments: this project's CSS explains its own cascade at
 *  length, which belongs in `styles/site.css` and not on the wire. It is roughly a third off the
 *  raw bytes and a little less off the gzipped ones, on every first visit.
 *
 *  The map is a separate file, so it costs a visitor nothing: a browser fetches it only when
 *  devtools are open. It keeps the served file debuggable in the browser despite being
 *  unreadable.
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
type AssetKind = keyof typeof SOURCE_MAP_COMMENT;

/** esbuild's loader, which is what the source is written in, and is no longer the same question
 *  as which comment syntax the served file takes: the search dialog is TypeScript compiled to a
 *  `.js`. */
const LOADER = { css: "css", ts: "ts" } as const;
type SourceLoader = (typeof LOADER)[keyof typeof LOADER];

function minify(
  source: string,
  filename: string,
  loader: SourceLoader,
  format?: "esm",
): { code: string; map: string } {
  const result = transformSync(source, {
    loader,
    minify: true,
    sourcefile: filename,
    sourcemap: true,
    // es2020 for the same reason src/templates/layout.ts pins it: everything this site is read in
    // has had optional chaining and nullish coalescing for years, and `esnext` would pass through
    // syntax newer than that.
    ...(format ? { format, target: "es2020" as const } : {}),
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
  kind: AssetKind,
): string {
  const { code, map } = built;
  const body = code.replace(/\/\/# sourceMappingURL=.*$/m, "").trimEnd();
  const withMapUrl = `${body}\n${SOURCE_MAP_COMMENT[kind](`${filename}.map`)}\n`;
  writeFileSync(join(dir, filename), withMapUrl, "utf-8");
  writeFileSync(join(dir, `${filename}.map`), map, "utf-8");
  return withMapUrl;
}

/** Client scripts that ship as files rather than being inlined into every page.
 *
 *  Only the search dialog, and ADR-0013 has why: it pulls in Pagefind's JS and WASM bundle, so a
 *  visitor who never searches should never load it. Everything else under `src/client/` is
 *  inlined by `src/templates/layout.ts` instead.
 *
 *  The value is the name it is served under, which `src/client/interaction.ts` imports by path.
 *  Not content-hashed, unlike the stylesheet, because that import names the URL and nothing
 *  rewrites it. */
const FETCHED_CLIENT_SCRIPTS = { "search.ts": "search.js" } as const;

export function copyPublic(distDir: string): void {
  cpSync(PUBLIC_DIR, distDir, { recursive: true });

  // public/ is copied verbatim, then the compiled client scripts are written alongside. Copying
  // first, rather than filtering the copy, keeps every static file (CNAME, the favicon,
  // .nojekyll) on the one path that has always handled them.
  const assetsDir = join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  for (const [source, served] of Object.entries(FETCHED_CLIENT_SCRIPTS)) {
    // `format: "esm"` because interaction.ts reaches this through a dynamic `import()`, so the
    // `export` has to survive. That is the difference from the inlined scripts, which are wrapped
    // in an IIFE precisely so that nothing they declare escapes.
    const code = readFileSync(join(CLIENT_DIR, source), "utf-8");
    writeMinified(assetsDir, served, minify(code, source, LOADER.ts, "esm"), "js");
  }

  // From node_modules rather than public/, so the font is a versioned dependency instead of a
  // binary in git. woff2 is already compressed; copying it verbatim is the whole job.
  //
  // Checked first because the failure it replaces is a bare ENOENT naming a path, thrown a long
  // way from the package bump that caused it. @fontsource decides both the directory and the
  // filename, and either can move in a major.
  if (!existsSync(FONT_SOURCE)) {
    throw new Error(
      `${FONT_SOURCE} does not exist: the @fontsource package layout has changed. Find the woff2 under node_modules/@fontsource/ and update FONT_SOURCE in src/paths.ts. ADR-0018 has what the file is for.`,
    );
  }
  cpSync(FONT_SOURCE, join(assetsDir, FONT_FILE));
}

/** Copies styles/site.css into dist/assets/site.<hash8>.css and returns its href.
 *
 *  `extraCss` is appended before hashing: the syntax-highlighting classes are cut from the
 *  rendered pages, so they only exist once the content has been rendered, and the hash has to
 *  cover them or a stale cached stylesheet would leave a page's code blocks uncoloured.
 *
 *  The hash is taken over the *minified* bytes, which are what gets served, since hashing the source
 *  instead would leave the URL unchanged when only the minifier's output moved. */
export function writeHashedCss(distDir: string, extraCss = ""): string {
  const base = readFileSync(join(STYLES_DIR, "site.css"), "utf-8");
  const source = extraCss
    ? `${base}\n/* Syntax highlighting, generated from the content. */\n${extraCss}\n`
    : base;

  // Named `site.css` in the map rather than the hashed output name, so devtools labels the
  // original something that means "the source" and not "the minified file".
  const built = minify(source, "site.css", LOADER.css);
  const hash = createHash("sha256").update(built.code).digest("hex").slice(0, 8);
  const filename = `site.${hash}.css`;
  const assetsDir = join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  writeMinified(assetsDir, filename, built, "css");
  return `/assets/${filename}`;
}
