import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import chokidar from "chokidar";
import { build } from "./build.js";
import { DIST_DIR as DIST, NOT_FOUND_FILE, OUTPUT_INDEX, ROOT } from "./paths.js";
import { LOCAL_PORT } from "./config.js";
/** `LOCAL_PORT` is what the README and the CI browser gates expect, and it is defined in
 *  `src/config.ts` because they resolve URLs against it too. `PORT` is there for the case that
 *  decided it: something else already holding the port, where a dev server that refuses to start
 *  is less useful than one on a different number. */
const PORT = Number(process.env["PORT"] ?? LOCAL_PORT);

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

/** Rebuilds the site in this process, rather than shelling out to `npx tsx src/build.ts`: that
 *  pays for a Node start and a fresh TypeScript transform per save, and throws away Shiki's
 *  highlighter, the expensive thing to construct, with the process.
 *
 *  The trade is that a change to `src/` itself is not picked up: the module graph is already
 *  loaded, and re-importing it would leak a new copy of every module per rebuild. The watcher
 *  below restarts the process for those instead. */
async function rebuild(): Promise<void> {
  if (building) {
    pendingRebuild = true;
    return;
  }
  building = true;
  const start = Date.now();
  try {
    await build();
    // build.ts wipes dist/ wholesale, so the index has to be regenerated alongside
    // every rebuild or /pagefind/pagefind.js 404s and search silently does nothing
    // locally. Run from node_modules/.bin rather than through `npx`, which spends longer
    // working out where the binary is than the indexing itself takes.
    execFileSync(join(ROOT, "node_modules", ".bin", "pagefind"), ["--site", "dist"], {
      cwd: ROOT,
      stdio: "ignore",
    });
    console.log(`rebuilt in ${Date.now() - start}ms`);
  } catch (err) {
    console.error("build failed:", err instanceof Error ? err.message : err);
  } finally {
    building = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      void rebuild();
    }
  }
}

function resolveFile(urlPath: string): string | null {
  // decodeURIComponent throws URIError on a malformed escape (e.g. "/%ZZ"), and an
  // uncaught throw in the request handler takes the whole dev server down, so treat
  // an undecodable path as simply not resolving to a file.
  let clean: string;
  try {
    clean = decodeURIComponent(urlPath.split("?")[0]!);
  } catch {
    return null;
  }
  const withoutTrailingSlash = clean.endsWith("/") && clean !== "/" ? clean.slice(0, -1) : clean;

  const candidates =
    withoutTrailingSlash === "/" || withoutTrailingSlash === ""
      ? [join(DIST, OUTPUT_INDEX)]
      : [join(DIST, withoutTrailingSlash), join(DIST, withoutTrailingSlash, OUTPUT_INDEX)];

  for (const candidate of candidates) {
    // path.join collapses ".." segments, so a URL like /../package.json can
    // resolve outside DIST, so reject anything that lands outside it.
    if (candidate !== DIST && !candidate.startsWith(DIST + sep)) continue;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = createServer((req, res) => {
  // Backstop: any throw in here would otherwise be an uncaught exception, which
  // kills the dev server mid-session and needs a manual restart.
  try {
    const url = req.url ?? "/";
    const file = resolveFile(url);

    if (file) {
      const type = MIME[extname(file)] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(readFileSync(file));
      return;
    }

    const notFound = join(DIST, NOT_FOUND_FILE);
    if (existsSync(notFound)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(readFileSync(notFound));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
    }
  } catch (err) {
    console.error(`error serving ${req.url}:`, err instanceof Error ? err.message : err);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 Internal Server Error");
  }
});

void rebuild();

// `scripts/fixtures` is watched because the about page's figures are counted from it: a page
// opts into the replay by having a setup script there, and adding or removing one changes what
// the built site claims about itself.
const watcher = chokidar.watch(["content", "src", "styles", "public", "scripts/fixtures"], {
  cwd: ROOT,
  ignoreInitial: true,
});
let debounce: ReturnType<typeof setTimeout> | undefined;
watcher.on("all", (_event, changedPath) => {
  // A change to the generator itself can't be picked up by re-running already-loaded modules,
  // so the process restarts instead. `tsx watch` would do this too, but only by restarting on
  // every change, including every content edit, which is the case that has to stay fast.
  if (changedPath.startsWith(`src${sep}`) && !changedPath.startsWith(join("src", "client"))) {
    console.log(`${changedPath} changed: restarting the dev server`);
    watcher.close().then(() => {
      server.close();
      spawnSync("npx", ["tsx", "src/server.ts"], { cwd: ROOT, stdio: "inherit" });
      process.exit(0);
    });
    return;
  }
  clearTimeout(debounce);
  debounce = setTimeout(() => void rebuild(), 150);
});

server.listen(PORT, () => {
  console.log(`dev server: http://localhost:${PORT}`);
});
