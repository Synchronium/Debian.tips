// Replays every page's documented output inside one disposable sandbox.
//
//   npm run replay                 # every page
//   npm run replay -- wget curl    # just these
//   npm run replay -- --changed    # only the pages a diff touches (what CI runs on a PR)
//
// The check `npm run check` can't make: that gate validates shape (schema, links, types)
// and would pass a page claiming output no command ever produced.
//
// Separate from `npm run check` because it needs Docker: the whole run takes about half a
// minute once the sandbox image exists, and a cold run is dominated by building that image.
//
//   npm run replay -- --order=reverse         # a different permutation, deterministically
//   npm run replay -- --order=random:abc123   # and a seeded one, reproducible from the seed
//
// Pages run one at a time, in one sandbox per flavour, and that is deliberate: every page
// sharing one container is what tests CLAUDE.md's third rule, that a page's setup script
// normalises what it needs rather than trusting what the last page left behind. See ADR-0002.
// What *is* cheap is not paying for a TypeScript startup per page, so the two replays are
// imported and called rather than spawned.
//
// The order within that one sandbox is a `--order` away: a fixed order tests exactly one of the
// possible orderings, and a page that passes only because of what ran before it passes anyway.
// The seed is always printed, so a shuffled failure names the command that reproduces it.
//
// Exit status: 0 when every page reproduces, 1 if any page fails, 2 if Docker is
// unavailable or an argument names no page.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ReplayError, readSetupDirectives } from "./lib/replayMetadata.js";
import { ORDER_MODE, type ReplayOrder, describeOrder, orderPages, parseOrder } from "./lib/replayOrder.js";
import { PROSE_CATEGORIES } from "../src/content/schema.js";
import { CONTENT_DIR, SANDBOX_SCRIPT, commandsDir, fixtureScript, proseSlug } from "../src/paths.js";
import { replayCommandPage } from "./replay-command-page.js";
import { replayProsePage } from "./replay-prose-page.js";
import { SANDBOX_FLAVOUR, type SandboxFlavour } from "./lib/sandbox.js";

const args = process.argv.slice(2);
const FLAGS = ["--changed"];
const unknownFlags = args.filter(
  (arg) => arg.startsWith("-") && !FLAGS.includes(arg) && !arg.startsWith("--order="),
);
if (unknownFlags.length) {
  console.error(
    `replay: unexpected argument ${unknownFlags[0]} (accepts ${FLAGS.join(", ")}, --order=<mode>)`,
  );
  process.exit(2);
}
const onlyChanged = args.includes("--changed");

let order: ReplayOrder;
try {
  const flag = args.find((arg) => arg.startsWith("--order="));
  order = parseOrder(flag ? flag.slice("--order=".length) : ORDER_MODE.alpha);
} catch (error) {
  console.error(`replay: ${(error as Error).message}`);
  process.exit(2);
}

const requestedPages = args.filter((arg) => !arg.startsWith("-"));

// Prose pages state their claims as Markdown fences rather than YAML, so the two kinds run
// through different replays.
const commandPages = readdirSync(commandsDir(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const prosePages = PROSE_CATEGORIES.flatMap((category) =>
  existsSync(join(CONTENT_DIR, category))
    ? readdirSync(join(CONTENT_DIR, category)).flatMap((file) => proseSlug(file) ?? [])
    : [],
);

const isProse = (name: string): boolean => prosePages.includes(name);

/** The pages a diff touches, for the pull-request run.
 *
 *  A page is in if its own content changed, if its setup script changed, or if anything shared
 *  by the harness changed (`_common.sh` bodies, the Python helpers, the normalisation rules),
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

  // `src/content/` is in this list because the replay imports from it: the fence-pairing rule,
  // the partition, the exemption parser and the comparison vocabulary all live there, and a
  // change to any of them can move any page's result. Leaving it out meant a pull request
  // touching the pairing rule replayed nothing at all, and a mis-paired fence reports as "not
  // checkable" rather than as broken, so the loss would have been silent.
  const harnessWide = changed.some(
    (file) =>
      file.startsWith("scripts/lib/") ||
      file.startsWith("scripts/sandbox") ||
      file.startsWith("src/content/") ||
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

// Not sorted here: `orderPages` sorts before it does anything else, so the order this arrives in
// cannot reach the run.
const selected = onlyChanged ? changedPages() : requestedPages;
const pages = [...commandPages, ...prosePages].filter((name) =>
  selected.length || onlyChanged ? selected.includes(name) : true,
);

const missing = requestedPages.filter((name) => !pages.includes(name));
if (missing.length) {
  console.error(`no such page: ${missing.join(", ")}`);
  process.exit(2);
}

// A page opts in to replay by having a setup script, and is otherwise reported rather than
// passed over: "17/17 replayed" and "14 replayed, 3 have no fixtures" are different claims
// about how much is checked. A page needing no sample files still gets one, holding only a
// comment saying so: an explicit "nothing to create here" beats an absence that reads as an
// oversight, and it keeps this gate meaningful instead of permanently red.
const unfixtured = pages.filter((name) => !existsSync(fixtureScript(name)));
const runnable = orderPages(
  pages.filter((name) => existsSync(fixtureScript(name))),
  order,
);

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
const flavourOf = (name: string): SandboxFlavour =>
  readSetupDirectives(fixtureScript(name)).needsSystemd ? SANDBOX_FLAVOUR.systemd : SANDBOX_FLAVOUR.default;
const flavours = new Map(runnable.map((name) => [name, flavourOf(name)]));
const neededFlavours = [...new Set(flavours.values())].sort();

// Registered before the first container starts: one left behind holds its name and its
// ports, and the next run would inherit whatever state it was left in.
const sandboxes = new Map<SandboxFlavour, string>();
let stopped = false;
const stop = (): void => {
  if (stopped) return;
  stopped = true;
  for (const name of sandboxes.values()) {
    try {
      execFileSync(SANDBOX_SCRIPT, ["stop", name], { stdio: "ignore" });
    } catch {
      console.error(`could not stop ${name}: remove it with: docker stop ${name}`);
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
  const startArgs = flavour === SANDBOX_FLAVOUR.systemd ? ["start", "--systemd"] : ["start"];
  sandboxes.set(flavour, execFileSync(SANDBOX_SCRIPT, startArgs, { encoding: "utf-8" }).trim());
}

const sandboxSummary = [...sandboxes].map(([flavour, name]) => `${name} (${flavour})`).join(", ");
console.log(`replaying ${runnable.length} page(s) in ${sandboxSummary}, order: ${describeOrder(order)}\n`);

const failed: string[] = [];
const started = Date.now();
for (const name of runnable) {
  const sandbox = sandboxes.get(flavours.get(name) ?? SANDBOX_FLAVOUR.default) ?? "";
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
  if (order.mode !== ORDER_MODE.alpha) {
    // A page can fail in one ordering and pass in another, which is a defect in that page rather
    // than in the run, so both commands are worth having: the first repeats this exact ordering,
    // the second says whether the ordering is what did it.
    console.log(`\nThis run was ordered ${describeOrder(order)}. To repeat it exactly:`);
    console.log(`  npm run replay -- --order=${describeOrder(order)}`);
    console.log("If it passes in the default order, the page depends on what ran before it:");
    console.log("  npm run replay");
  }
}
process.exit(failed.length === 0 ? 0 : 1);
