// Replays every page's documented output inside one disposable sandbox.
//
//   npm run replay                 # every page
//   npm run replay -- wget curl    # just these
//   npm run replay -- --changed    # only the pages a diff touches (what CI runs on a PR)
//
// The check `npm run check` can't make: that gate validates shape — schema, links, types —
// and would pass a page claiming output no command ever produced.
//
// Separate from `npm run check` because it needs Docker: the whole run takes about half a
// minute once the sandbox image exists, and a cold run is dominated by building that image.
//
// Pages run one at a time, in one sandbox per flavour, and that is deliberate: every page
// sharing one container in a fixed order is what tests CLAUDE.md's third rule, that a page's
// setup script normalises what it needs rather than trusting what the last page left behind.
// Parallelising across a pool would weaken that; _PLANS/PLAN-CODE-IMPROVEMENTS.md says what it
// would take. What *is* cheap is not paying for a TypeScript startup per page, so the two
// verifiers are imported and called rather than spawned.
//
// Exit status: 0 when every page reproduces, 1 if any page fails, 2 if Docker is
// unavailable or an argument names no page.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ReplayError, readSetupDirectives } from "./lib/replay.js";
import { PROSE_CATEGORIES } from "../src/content/schema.js";
import { CONTENT_DIR, SANDBOX_SCRIPT, fixtureScript } from "../src/paths.js";
import { replayCommandPage } from "./verify-examples.js";
import { replayProsePage } from "./verify-prose.js";

const args = process.argv.slice(2);
const FLAGS = ["--changed"];
const unknownFlags = args.filter((arg) => arg.startsWith("-") && !FLAGS.includes(arg));
if (unknownFlags.length) {
  console.error(`replay: unexpected argument ${unknownFlags[0]} (accepts ${FLAGS.join(", ")})`);
  process.exit(2);
}
const onlyChanged = args.includes("--changed");
const requestedPages = args.filter((arg) => !arg.startsWith("-"));

// Prose pages state their claims as Markdown fences rather than YAML, so they run through
// verify-prose.ts rather than verify-examples.ts.
const commandPages = readdirSync(join(CONTENT_DIR, "commands"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const prosePages = PROSE_CATEGORIES.flatMap((category) =>
  existsSync(join(CONTENT_DIR, category))
    ? readdirSync(join(CONTENT_DIR, category))
        .filter((file) => file.endsWith(".md"))
        .map((file) => file.replace(/\.md$/, ""))
    : [],
);

const isProse = (name: string): boolean => prosePages.includes(name);

/** The pages a diff touches, for the pull-request run.
 *
 *  A page is in if its own content changed, if its setup script changed, or if anything shared
 *  by the harness changed — `_common.sh` bodies, the Python helpers, the normalisation rules —
 *  in which case every page is back in, because a change there can move any page's output. The
 *  full set still runs on `main`, so this only ever trades a slower signal for a faster one on
 *  the branch, never a missing one before deployment. */
function changedPages(): string[] {
  const base = process.env["REPLAY_DIFF_BASE"] ?? "origin/main";
  const git = (...gitArgs: string[]): string[] =>
    execFileSync("git", gitArgs, { encoding: "utf-8" })
      .split("\n")
      .filter((line) => line !== "");

  let changed: string[];
  try {
    changed = [
      // What the branch changed…
      ...git("diff", "--name-only", `${base}...HEAD`),
      // …and what has not been committed yet, so running this locally over work in progress
      // replays the page being worked on rather than reporting that nothing changed.
      ...git("status", "--porcelain=v1", "--untracked-files=all").map((line) => line.slice(3)),
    ];
  } catch {
    console.error(`replay --changed: could not diff against ${base}; replaying everything instead.`);
    return [...commandPages, ...prosePages];
  }

  const harnessWide = changed.some(
    (file) =>
      file.startsWith("scripts/lib/") ||
      file.startsWith("scripts/sandbox") ||
      file === "scripts/fixtures/_common.sh" ||
      file.endsWith(".py"),
  );
  if (harnessWide) return [...commandPages, ...prosePages];

  const touched = new Set<string>();
  for (const file of changed) {
    const command = /^content\/commands\/([^/]+)\//.exec(file);
    if (command?.[1]) touched.add(command[1]);
    const prose = /^content\/[^/]+\/([^/]+)\.md$/.exec(file);
    if (prose?.[1]) touched.add(prose[1]);
    const fixture = /^scripts\/fixtures\/([^/]+)\.(sh|skip)$/.exec(file);
    if (fixture?.[1]) touched.add(fixture[1]);
  }
  return [...touched];
}

const selected = onlyChanged ? changedPages() : requestedPages;
const pages = [...commandPages, ...prosePages]
  .filter((name) => (selected.length || onlyChanged ? selected.includes(name) : true))
  .sort();

const missing = requestedPages.filter((name) => !pages.includes(name));
if (missing.length) {
  console.error(`no such page: ${missing.join(", ")}`);
  process.exit(2);
}

// A page opts in to replay by having a setup script, and is otherwise reported rather than
// passed over: "17/17 replayed" and "14 replayed, 3 have no fixtures" are different claims
// about how much is checked. A page needing no sample files still gets one, holding only a
// comment saying so — an explicit "nothing to create here" beats an absence that reads as an
// oversight, and it keeps this gate meaningful instead of permanently red.
const runnable = pages.filter((name) => existsSync(fixtureScript(name)));
const unfixtured = pages.filter((name) => !runnable.includes(name));

if (runnable.length === 0) {
  console.log(onlyChanged ? "no changed page has examples to replay." : "nothing to replay.");
  process.exit(0);
}

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
  readSetupDirectives(fixtureScript(name)).needsSystemd ? "systemd" : "default";
const flavours = new Map(runnable.map((name) => [name, flavourOf(name)]));
const neededFlavours = [...new Set(flavours.values())].sort();

// Registered before the first container starts: one left behind holds its name and its
// ports, and the next run would inherit whatever state it was left in.
const sandboxes = new Map<Flavour, string>();
let stopped = false;
const stop = (): void => {
  if (stopped) return;
  stopped = true;
  for (const name of sandboxes.values()) {
    try {
      execFileSync(SANDBOX_SCRIPT, ["stop", name], { stdio: "ignore" });
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
  const startArgs = flavour === "systemd" ? ["start", "--systemd"] : ["start"];
  sandboxes.set(flavour, execFileSync(SANDBOX_SCRIPT, startArgs, { encoding: "utf-8" }).trim());
}

const sandboxSummary = [...sandboxes].map(([flavour, name]) => `${name} (${flavour})`).join(", ");
console.log(`replaying ${runnable.length} page(s) in ${sandboxSummary}\n`);

const failed: string[] = [];
const started = Date.now();
for (const name of runnable) {
  const sandbox = sandboxes.get(flavours.get(name) ?? "default") ?? "";
  const setupPath = fixtureScript(name);
  try {
    const result = isProse(name)
      ? replayProsePage({ sandbox, slug: name, setupPath })
      : replayCommandPage({ sandbox, command: name, setupPath });
    if (result.mismatches > 0) failed.push(name);
  } catch (error) {
    if (!(error instanceof ReplayError)) throw error;
    // One page's setup failing says nothing about the next page's, so the batch carries on and
    // reports it alongside the mismatches rather than taking the whole run down.
    console.error(`\n${name}: ${error.message}`);
    failed.push(name);
  }
}

const seconds = Math.round((Date.now() - started) / 1000);
console.log(`\n${runnable.length - failed.length}/${runnable.length} pages replay exactly (${seconds}s)`);
if (unfixtured.length) {
  console.log(`not replayed, no scripts/fixtures/<slug>.sh: ${unfixtured.join(", ")}`);
}
if (failed.length) {
  console.log(`\nfailing: ${failed.join(", ")}`);
  console.log("Each mismatch above names the first line that differs. The real output is the truth:");
  console.log("re-capture with scripts/adopt-real-output.ts once you've confirmed the command is right.");
}
process.exit(failed.length === 0 ? 0 : 1);
