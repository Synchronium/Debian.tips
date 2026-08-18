// Replays every command page's documented output inside one disposable sandbox.
//
//   npm run replay              # every page
//   npm run replay -- wget curl # just these
//
// The check `npm run check` can't make: that gate validates shape — schema, links, types —
// and would pass a page claiming output no command ever produced.
//
// Separate from `npm run check` because it needs Docker: the whole run takes about half a
// minute once the sandbox image exists, and a cold run is dominated by building that image.
//
// Exit status: 0 when every page reproduces, 1 if any page fails, 2 if Docker is
// unavailable or an argument names no page.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readSetupDirectives } from "./lib/replay.js";

const requestedPages = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

/** Prose pages state their claims as Markdown fences rather than YAML, so they run through
 *  verify-prose.ts. Only those with a setup script are replayed; the rest are reported. */
const PROSE_CATEGORIES = ["concepts", "scripting", "recipes", "debian"];

const commandPages = readdirSync("content/commands", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const prosePages = PROSE_CATEGORIES.flatMap((category) =>
  existsSync(`content/${category}`)
    ? readdirSync(`content/${category}`)
        .filter((file) => file.endsWith(".md"))
        .map((file) => file.replace(/\.md$/, ""))
    : [],
);

const isProse = (name: string): boolean => prosePages.includes(name);
const pages = [...commandPages, ...prosePages]
  .filter((name) => (requestedPages.length ? requestedPages.includes(name) : true))
  .sort();

const missing = requestedPages.filter((name) => !pages.includes(name));
if (missing.length) {
  console.error(`no such page: ${missing.join(", ")}`);
  process.exit(2);
}

// Pages with no setup script are reported rather than passed over: "17/17 replayed" and
// "14 replayed, 3 have no fixtures" are different claims about how much is checked.
const runnable = pages.filter((name) => existsSync(`scripts/fixtures/${name}.sh`));
const unfixtured = pages.filter((name) => !runnable.includes(name));

try {
  execFileSync("docker", ["info"], { stdio: "ignore" });
} catch {
  console.error("replay needs Docker: the examples run inside a disposable container, never on this host.");
  process.exit(2);
}

// A page declaring `# verify: --systemd` needs a sandbox booted with systemd as PID 1,
// which costs --privileged and the host's cgroup tree. Each flavour is started only if a
// page in this run asks for it.
type Flavour = "default" | "systemd";
const flavourOf = (name: string): Flavour =>
  readSetupDirectives(`scripts/fixtures/${name}.sh`).needsSystemd ? "systemd" : "default";
const neededFlavours = [...new Set(runnable.map(flavourOf))].sort();

// Registered before the first container starts: one left behind holds its name and its
// ports, and the next run would inherit whatever state it was left in.
const sandboxes = new Map<Flavour, string>();
let stopped = false;
const stop = () => {
  if (stopped) return;
  stopped = true;
  for (const name of sandboxes.values()) {
    try {
      execFileSync("scripts/sandbox.sh", ["stop", name], { stdio: "ignore" });
    } catch {
      console.error(`could not stop ${name} — remove it with: docker stop ${name}`);
    }
  }
};
process.on("exit", stop);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop();
    process.exit(130);
  });
}

for (const flavour of neededFlavours) {
  const args = flavour === "systemd" ? ["start", "--systemd"] : ["start"];
  sandboxes.set(flavour, execFileSync("scripts/sandbox.sh", args, { encoding: "utf-8" }).trim());
}

const sandboxSummary = [...sandboxes].map(([flavour, name]) => `${name} (${flavour})`).join(", ");
console.log(`replaying ${runnable.length} page(s) in ${sandboxSummary}\n`);

const failed: string[] = [];
const started = Date.now();
for (const name of runnable) {
  const runner = isProse(name) ? "scripts/verify-prose.ts" : "scripts/verify-examples.ts";
  const result = spawnSync(
    "npx",
    ["tsx", runner, sandboxes.get(flavourOf(name)) ?? "", name, `scripts/fixtures/${name}.sh`],
    { stdio: "inherit" },
  );
  if (result.status !== 0) failed.push(name);
}

const seconds = Math.round((Date.now() - started) / 1000);
console.log(`\n${runnable.length - failed.length}/${runnable.length} pages replay exactly (${seconds}s)`);
if (unfixtured.length) {
  console.log(`not replayed, no scripts/fixtures/<command>.sh: ${unfixtured.join(", ")}`);
}
if (failed.length) {
  console.log(`\nfailing: ${failed.join(", ")}`);
  console.log("Each mismatch above names the first line that differs. The real output is the truth:");
  console.log("re-capture with scripts/adopt-real-output.ts once you've confirmed the command is right.");
}
process.exit(failed.length === 0 ? 0 : 1);
