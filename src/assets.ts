import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_DIR, STYLES_DIR } from "./paths.js";

export function copyPublic(distDir: string): void {
  cpSync(PUBLIC_DIR, distDir, { recursive: true });
}

/** Copies styles/site.css into dist/assets/site.<hash8>.css and returns its href.
 *
 *  `extraCss` is appended before hashing: the syntax-highlighting classes are cut from the
 *  rendered pages, so they only exist once the content has been rendered, and the hash has to
 *  cover them or a stale cached stylesheet would leave a page's code blocks uncoloured. */
export function writeHashedCss(distDir: string, extraCss = ""): string {
  const base = readFileSync(join(STYLES_DIR, "site.css"), "utf-8");
  const source = extraCss
    ? `${base}\n/* Syntax highlighting, generated from the content. */\n${extraCss}\n`
    : base;
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 8);
  const filename = `site.${hash}.css`;
  const assetsDir = join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(assetsDir, filename), source, "utf-8");
  return `/assets/${filename}`;
}
