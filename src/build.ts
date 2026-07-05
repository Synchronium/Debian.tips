import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { html, raw } from "./html.js";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const PUBLIC = join(ROOT, "public");

function clean(): void {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
}

function copyPublic(): void {
  cpSync(PUBLIC, DIST, { recursive: true });
}

function placeholderPage(): string {
  return html`<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>debian.tips — Linux tips &amp; tricks</title>
  <meta name="description" content="Practical Linux and Debian tips, tricks, and command references." />
</head>
<body>
  <main id="main" data-pagefind-body>
    <h1>debian.tips</h1>
    <p>The generator core (content loader, templates, styling) lands in M1. This page exists so the build pipeline has real output to validate end-to-end.</p>
  </main>
</body>
</html>
`;
}

function writeHome(): void {
  writeFileSync(join(DIST, "index.html"), raw(placeholderPage()).value, "utf-8");
}

function main(): void {
  clean();
  copyPublic();
  writeHome();
  console.log("Built placeholder site to dist/ (M0 scaffold — see PLAN-ROADMAP.md M1)");
}

main();
