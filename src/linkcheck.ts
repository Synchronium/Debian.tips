import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i; // has a scheme, or is protocol-relative

function findHtmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry.endsWith(".html")) out.push(full);
  }
  return out;
}

function toUrlPath(distFile: string): string {
  const rel = distFile.slice(DIST.length).replace(/\\/g, "/");
  return rel.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";
}

function extractLinks(htmlSource: string): string[] {
  const links: string[] = [];
  for (const m of htmlSource.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    if (m[1] !== undefined) links.push(m[1]);
  }
  return links;
}

function resolveDistPath(urlPath: string): string | null {
  const clean = urlPath.split("#")[0]!.split("?")[0]!;
  if (clean === "" || clean === "/") return join(DIST, "index.html");
  const withoutTrailingSlash = clean.endsWith("/") ? clean.slice(0, -1) : clean;
  const asDir = join(DIST, withoutTrailingSlash, "index.html");
  if (existsSync(asDir)) return asDir;
  const asFile = join(DIST, withoutTrailingSlash);
  if (existsSync(asFile) && statSync(asFile).isFile()) return asFile;
  return null;
}

function idsInFile(distFile: string): Set<string> {
  const source = readFileSync(distFile, "utf-8");
  const ids = new Set<string>();
  for (const m of source.matchAll(/\sid="([^"]+)"/g)) {
    if (m[1] !== undefined) ids.add(m[1]);
  }
  return ids;
}

function main(): void {
  if (!existsSync(DIST)) {
    console.error("dist/ does not exist — run the build first");
    process.exit(1);
  }

  const pages = findHtmlFiles(DIST);
  const errors: string[] = [];

  for (const page of pages) {
    const pageUrl = toUrlPath(page);
    const links = extractLinks(readFileSync(page, "utf-8"));

    for (const link of links) {
      if (EXTERNAL.test(link) || link.startsWith("mailto:") || link.startsWith("tel:")) continue;

      const isFragmentOnly = link.startsWith("#");
      const absolutePath = isFragmentOnly ? pageUrl : posix.resolve(posix.dirname(pageUrl), link);
      const targetFile = resolveDistPath(absolutePath);

      if (!targetFile) {
        errors.push(`${pageUrl}: broken link "${link}" (resolved to "${absolutePath}")`);
        continue;
      }

      const fragment = link.split("#")[1];
      if (fragment && !idsInFile(targetFile).has(fragment)) {
        errors.push(`${pageUrl}: broken anchor "${link}" — no id="${fragment}" on target page`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`linkcheck failed with ${errors.length} error(s):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`linkcheck passed: ${pages.length} page(s), no broken links.`);
}

main();
