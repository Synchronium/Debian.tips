// Replays every command page's documented output inside one disposable sandbox.
//
//   npm run replay              # every page
//   npm run replay -- wget curl # just these
//
// This is the check `npm run check` can't make. That gate validates *shape* — schema,
// links, types — and every page it passes could still claim output no command ever
// produced. Replaying is the only thing that tests the site's actual promise, and until
// now it meant knowing to start a sandbox, knowing which pages exist, and remembering to
// stop the container afterwards.
//
// Kept separate from `npm run check` because it needs Docker, not because it is slow: all
// seventeen pages replay in about 30 seconds once the sandbox image exists. A cold run is
// dominated by building that image.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readSetupDirectives } from "./lib/replay.js";

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const pages = readdirSync("content/commands", { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => (only.length ? only.includes(name) : true))
  .sort();

const missing = only.filter((name) => !pages.includes(name));
if (missing.length) {
  console.error(`no such command page: ${missing.join(", ")}`);
  process.exit(2);
}

// A page with no setup script is reported rather than skipped in silence: "17/17 pages
// replayed" and "14 pages replayed, 3 have no fixtures" are very different claims about
// how much of the site is actually checked.
const runnable = pages.filter((name) => existsSync(`scripts/fixtures/${name}.sh`));
const unfixtured = pages.filter((name) => !runnable.includes(name));

try {
  execFileSync("docker", ["info"], { stdio: "ignore" });
} catch {
  console.error("replay needs Docker: the examples run inside a disposable container, never on this host.");
  process.exit(2);
}

// Pages that declare `# verify: --systemd` need a sandbox booted with systemd as PID 1,
// which the default one deliberately isn't — it costs --privileged and the host cgroup
// tree. Each flavour is started only if some page asks for it, so a run that touches no
// systemd page grants nothing extra.
type Flavour = "default" | "systemd";
const flavourOf = (name: string): Flavour =>
  readSetupDirectives(`scripts/fixtures/${name}.sh`).needsSystemd ? "systemd" : "default";
const needed = [...new Set(runnable.map(flavourOf))].sort();

// Registered before the first container starts. One left behind holds its name, its image
// layer and port 8080, and the next run inherits whatever state it was in.
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

for (const flavour of needed) {
  const args = flavour === "systemd" ? ["start", "--systemd"] : ["start"];
  sandboxes.set(flavour, execFileSync("scripts/sandbox.sh", args, { encoding: "utf-8" }).trim());
}

const describe = [...sandboxes].map(([flavour, name]) => `${name} (${flavour})`).join(", ");
console.log(`replaying ${runnable.length} page(s) in ${describe}\n`);

const failed = [];
const started = Date.now();
for (const name of runnable) {
  const result = spawnSync(
    "npx",
    // tsx, because these are TypeScript now; `npm run replay` guarantees it is installed.
    ["tsx", "scripts/verify-examples.ts", sandboxes.get(flavourOf(name)) ?? "", name, `scripts/fixtures/${name}.sh`],
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
