import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import chokidar from "chokidar";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const PORT = 4321;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

let building = false;
let pendingRebuild = false;

function build(): void {
  if (building) {
    pendingRebuild = true;
    return;
  }
  building = true;
  const start = Date.now();
  try {
    execFileSync("npx", ["tsx", "src/build.ts"], { cwd: ROOT, stdio: "inherit" });
    console.log(`rebuilt in ${Date.now() - start}ms`);
  } catch (err) {
    console.error("build failed:", (err as Error).message);
  } finally {
    building = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      build();
    }
  }
}

function resolveFile(urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split("?")[0]!);
  const withoutTrailingSlash = clean.endsWith("/") && clean !== "/" ? clean.slice(0, -1) : clean;

  const candidates =
    withoutTrailingSlash === "/" || withoutTrailingSlash === ""
      ? [join(DIST, "index.html")]
      : [join(DIST, withoutTrailingSlash), join(DIST, withoutTrailingSlash, "index.html")];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  const file = resolveFile(url);

  if (file) {
    const type = MIME[extname(file)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(readFileSync(file));
    return;
  }

  const notFound = join(DIST, "404.html");
  if (existsSync(notFound)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readFileSync(notFound));
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

build();

const watcher = chokidar.watch(["content", "src", "styles", "public"], {
  cwd: ROOT,
  ignoreInitial: true,
});
let debounce: ReturnType<typeof setTimeout> | undefined;
watcher.on("all", () => {
  clearTimeout(debounce);
  debounce = setTimeout(build, 150);
});

server.listen(PORT, () => {
  console.log(`dev server: http://localhost:${PORT}`);
});
