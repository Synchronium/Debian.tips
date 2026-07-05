import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

export function copyPublic(distDir: string): void {
  cpSync(join(ROOT, "public"), distDir, { recursive: true });
}

/** Copies styles/site.css into dist/assets/site.<hash8>.css and returns its href. */
export function writeHashedCss(distDir: string): string {
  const source = readFileSync(join(ROOT, "styles", "site.css"), "utf-8");
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 8);
  const filename = `site.${hash}.css`;
  const assetsDir = join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(assetsDir, filename), source, "utf-8");
  return `/assets/${filename}`;
}
