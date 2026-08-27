// Replays every page's documented output inside a disposable sandbox of its own.
//
//   npm run replay                 # every page
//   npm run replay -- wget curl    # just these
//   npm run replay -- --changed    # only the pages a diff touches (what CI runs on a PR)
//   npm run replay -- --shard=2/7  # one part of whichever of those two a run selected
//
// The check `npm run check` can't make: that gate validates shape (schema, links, types)
// and would pass a page claiming output no command ever produced.
//
// Separate from `npm run check` because it needs Docker, and because "the generator is broken"
// and "a page is lying" are different problems. A cold run is dominated by building the image.
//
// **One container per page, torn down after it.** A page cannot see what another page installed,
// configured, bound or left running, so what a page claims depends on the image and on its own
// setup script and on nothing else. See ADR-0020, which supersedes the shared sandbox this ran in
// before. The consequence worth knowing while reading a failure: a single-page run and a full run
// put a page in the identical container, so `npm run replay -- <page>` reproduces a batch failure
// exactly, and the order pages run in cannot change any result.
//
// The two replays are imported and called rather than spawned, so a serial run at least does not
// pay for a TypeScript startup per page.
//
// Exit status: 0 when every page reproduces, 1 if any page fails, 2 if Docker is
// unavailable or an argument names no page.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import { ReplayError, readSetupDirectives } from "./lib/replayMetadata.js";
import { REPLAY_TIMINGS_FILE, ROOT, SANDBOX_SCRIPT, fixtureScript } from "../src/paths.js";
import { replayCommandPage } from "./replay-command-page.js";
import { replayProsePage } from "./replay-prose-page.js";
import { SANDBOX_FLAVOUR, type SandboxFlavour } from "./lib/sandbox.js";
import { type Shard, ShardError, parseShard, shardCosts, shardPages } from "./lib/replayShard.js";
import {
  ambiguousSlugs,
  commandPages as listCommandPages,
  hasSetupScript,
  pageId,
  prosePages as listProsePages,
} from "./lib/replayPages.js";

const args = process.argv.slice(2);
const FLAGS = ["--changed", "--record-timings"];
const VALUE_FLAGS = ["--shard=", "--timings-out="];
const unknownFlags = args.filter(
  (arg) => arg.startsWith("-") && !FLAGS.includes(arg) && !VALUE_FLAGS.some((f) => arg.startsWith(f)),
);
if (unknownFlags.length) {
  console.error(
    `replay: unexpected argument ${unknownFlags[0]} (accepts ${FLAGS.join(", ")}, --shard=<i>/<n>, --timings-out=<file>)`,
  );
  process.exit(2);
}
const onlyChanged = args.includes("--changed");
const recordTimings = args.includes("--record-timings");
// Where a shard leaves its own measurements for something else to merge, which is how CI records
// timings without any shard being allowed to write the file every shard reads. Unlike
// --record-timings this makes no claim to be complete, so it carries no restriction: whoever
// merges the parts is the one that can see whether the whole site is covered.
const timingsOut = args.find((arg) => arg.startsWith("--timings-out="))?.slice("--timings-out=".length);

let shard: Shard = { index: 1, total: 1 };
try {
  const flag = args.find((arg) => arg.startsWith("--shard="));
  if (flag) shard = parseShard(flag.slice("--shard=".length));
} catch (error) {
  console.error(`replay: ${(error as ShardError).message}`);
  process.exit(2);
}

// Recording a partial run would overwrite the times of every page not in it. The file balances
// the shards, so a shard writing it is also the case where the damage is least visible.
if (recordTimings && (shard.total > 1 || onlyChanged || args.some((a) => !a.startsWith("-")))) {
  console.error("replay: --record-timings needs the full run, so it cannot be combined with");
  console.error("  --shard, --changed, or named pages.");
  process.exit(2);
}

// Before anything asks which page a slug means. A setup script names a slug and no category, so a
// slug two pages share cannot be attributed to either, and every page's cost, timing and estimate
// is stored per page. Refusing here beats a stack trace out of the shard partition, which is where
// this surfaces otherwise, several steps from the two files that caused it.
const ambiguous = ambiguousSlugs();
if (ambiguous.length) {
  console.error("replay: a setup script names a slug and no category, so these have one each and");
  console.error("  name two pages, and nothing can say which page the script belongs to:");
  console.error(`    ${ambiguous.join(", ")}`);
  console.error("  Rename one page of each pair, or drop the script.");
  process.exit(2);
}

const requestedPages = args.filter((arg) => !arg.startsWith("-"));

// Naming pages and then sharding them replays whichever of them the split happened to put in this
// shard, and none at all in the other shards, each exiting 0. `--changed` is the combination that
// is meant: it selects a set, and CI shards that set across its runners.
if (shard.total > 1 && requestedPages.length) {
  console.error("replay: --shard splits a whole run, so it cannot be combined with named pages.");
  console.error(`  Drop --shard to replay ${requestedPages.join(", ")} directly.`);
  process.exit(2);
}

// Prose pages state their claims as Markdown fences rather than YAML, so the two kinds run
// through different replays. Both lists come from scripts/lib/replayPages.ts, which is also what
// the timings check reads, so neither can start describing a different site from the other.
const commandPages = listCommandPages();
const prosePages = listProsePages();

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
const unfixtured = pages.filter((name) => !hasSetupScript(name));
const replayable = pages.filter(hasSetupScript);
// Sorted only so the report reads in a predictable order. Each page gets its own container, so
// the order carries nothing else: it cannot change any page's result.
const runnable = shardPages(replayable, shard, shardCosts(replayable)).sort();

if (replayable.length === 0) {
  console.log(onlyChanged ? "no changed page has examples to replay." : "nothing to replay.");
  process.exit(0);
}
// An empty shard is a legitimate outcome, not an error: `--changed` over a small diff has fewer
// pages than there are shards. Saying which shard was empty keeps a run that replayed nothing
// distinguishable in the log from one that was never given anything.
if (runnable.length === 0) {
  console.log(`shard ${shard.index}/${shard.total} has no pages of the ${replayable.length} to replay.`);
  process.exit(0);
}

try {
  execFileSync("docker", ["info"], { stdio: "ignore" });
} catch {
  console.error("replay needs Docker: the examples run inside a disposable container, never on this host.");
  process.exit(2);
}

// A page declaring `# verify: --systemd` needs a sandbox booted with systemd as PID 1, which
// costs --privileged and the host's cgroup tree, so it is asked for per page rather than given
// to every page.
const flavourOf = (name: string): SandboxFlavour =>
  readSetupDirectives(fixtureScript(name)).needsSystemd ? SANDBOX_FLAVOUR.systemd : SANDBOX_FLAVOUR.default;

/** Names a container after the run that owns it and the page it is replaying, so `docker ps`
 *  during a long run says what is happening, and so the sweep below can tell three things apart:
 *  a container this run owns, one another live run owns, and one nobody owns any more.
 *
 *  The `content-sandbox-` stem is required by `scripts/sandbox.sh`, so a sandbox somebody started
 *  by hand to write a page with shares it. That is why the run marker comes after the stem rather
 *  than replacing it: a hand-started sandbox never matches, and is never swept. */
const RUN_PREFIX = "content-sandbox-replay";
const containerFor = (page: string): string =>
  `${RUN_PREFIX}${process.pid}-${page.replace(/[^a-z0-9-]/gi, "-")}`;

/** Removes containers left behind by a replay that is no longer running.
 *
 *  Tearing down after each page covers the ordinary paths, and the handlers below cover an
 *  interrupt between pages. Neither covers an interrupt that arrives *mid-example*: the loop is
 *  blocked inside a synchronous `docker exec`, a JavaScript signal handler cannot run until that
 *  returns, and whatever kills the process first wins. A privileged container then outlives its
 *  run, and the next thing to notice is usually a port still being held. Sweeping at the start
 *  rather than trying harder at the end also covers a crash and a `kill -9`, which no handler can.
 *
 *  Ownership is decided by the pid in the name, so a second replay running at the same time keeps
 *  its containers. Nothing here needs two replays to work, but silently destroying another one's
 *  sandboxes mid-run would report as a page failing.
 *
 *  A pid the kernel has since handed to some unrelated process therefore reads as a live owner,
 *  and that container survives the sweep. Telling that apart from a concurrent replay would take
 *  the owner's start time as well, which is not portable. It costs a leaked container until the
 *  next reboot, and it cannot cost a *result*: the one pid this run names containers with is its
 *  own, so the only leftover that can ever collide with a name we are about to claim is one
 *  carrying our pid, which is swept below whatever `process.kill` says about it. */
function sweepAbandoned(): void {
  // Nothing has been started yet when this runs, so a container in our own name is the residue of
  // an earlier run the kernel has since given our pid to, never a container we are using. Left in
  // place it takes the name that page is about to ask for, `docker run` exits 125, and the page
  // reports as unreplayable for as long as the container is there.
  const abandonedBy = (pid: number): boolean => {
    if (pid === process.pid) return true;
    try {
      process.kill(pid, 0);
      return false;
    } catch {
      return true;
    }
  };

  let abandoned: string[];
  try {
    abandoned = execFileSync(
      "docker",
      ["ps", "-a", "--filter", `name=^${RUN_PREFIX}`, "--format", "{{.Names}}"],
      {
        encoding: "utf-8",
      },
    )
      .split("\n")
      .filter((name) => {
        const owner = new RegExp(`^${RUN_PREFIX}(\\d+)-`).exec(name);
        return owner?.[1] !== undefined && abandonedBy(Number(owner[1]));
      });
  } catch {
    return;
  }
  if (!abandoned.length) return;
  console.log(`removing ${abandoned.length} sandbox(es) left by an interrupted run`);
  try {
    execFileSync("docker", ["rm", "-f", ...abandoned], { stdio: "ignore" });
  } catch {
    console.error("could not remove them; `docker ps -a` will list what is left");
  }
}

// Whatever is running right now, so an interrupt takes it down with it. A container left behind
// holds its name, its ports and its privileges until someone notices.
let live = "";
const stopLive = (): void => {
  if (!live) return;
  const name = live;
  live = "";
  try {
    execFileSync(SANDBOX_SCRIPT, ["stop", name], { stdio: "ignore" });
  } catch {
    console.error(`could not stop ${name}: remove it with: docker rm -f ${name}`);
  }
};
process.on("exit", stopLive);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopLive();
    process.exit(130);
  });
}

sweepAbandoned();
const of = shard.total > 1 ? ` of ${replayable.length}, shard ${shard.index}/${shard.total}` : "";
console.log(`replaying ${runnable.length} page(s)${of}, one container each\n`);

const failed: string[] = [];
const elapsed = new Map<string, number>();
const started = Date.now();
for (const name of runnable) {
  const pageStarted = Date.now();
  const setupPath = fixtureScript(name);
  const startArgs = flavourOf(name) === SANDBOX_FLAVOUR.systemd ? ["start", "--systemd"] : ["start"];
  startArgs.push(containerFor(name));
  try {
    live = execFileSync(SANDBOX_SCRIPT, startArgs, { encoding: "utf-8" }).trim();
  } catch {
    // Starting a container is the harness failing, not the page. Report it against the page so
    // the run still names what went unchecked, and carry on: the next page gets its own attempt.
    console.error(`\n${name}: could not start a sandbox`);
    failed.push(name);
    continue;
  }
  try {
    const result = isProse(name)
      ? replayProsePage({ sandbox: live, slug: name, setupPath })
      : replayCommandPage({ sandbox: live, command: name, setupPath });
    if (result.mismatches > 0) failed.push(name);
  } catch (error) {
    if (!(error instanceof ReplayError)) {
      stopLive();
      throw error;
    }
    // One page's setup failing says nothing about the next page's, so the batch carries on and
    // reports it alongside the mismatches rather than taking the whole run down.
    console.error(`\n${name}: ${error.message}`);
    failed.push(name);
  } finally {
    stopLive();
    elapsed.set(name, Math.round((Date.now() - pageStarted) / 100) / 10);
  }
}

const seconds = Math.round((Date.now() - started) / 1000);
const inShard = shard.total > 1 ? ` in shard ${shard.index}/${shard.total}` : "";
console.log(
  `\n${runnable.length - failed.length}/${runnable.length} pages replay exactly${inShard} (${seconds}s)`,
);
// A page with no setup script belongs to no shard, so this list is every such page in the whole
// selection rather than this shard's share of them. Two counts a line apart that cover different
// populations read as one, so the sharded run says which is which.
if (unfixtured.length) {
  const scope = shard.total > 1 ? " by any shard" : "";
  console.log(`not replayed${scope}, no scripts/fixtures/<slug>.sh: ${unfixtured.join(", ")}`);
}

// Sorted by name rather than by duration, so the diff between two recordings reads as "what
// changed" rather than as a reordering.
const measured = (): Record<string, number> =>
  Object.fromEntries(
    [...elapsed]
      .map(([name, seconds]) => [pageId(name), seconds] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

if (timingsOut) {
  writeFileSync(timingsOut, `${JSON.stringify(measured(), null, 2)}\n`);
  console.log(`Wrote ${elapsed.size} page times to ${timingsOut}`);
}

if (recordTimings) {
  // A page whose sandbox never started has no time to record, and writing the file without it
  // drops that page to the default of a couple of seconds. The heavy pages are exactly the ones
  // worth balancing, so losing one costs the next run roughly that page's whole duration on
  // whichever shard it lands in. Refusing to write leaves the previous figures in place, which
  // are merely stale rather than wrong.
  const unrecorded = runnable.filter((name) => !elapsed.has(name));
  if (unrecorded.length) {
    console.error(`\nNot recording timings: no time for ${unrecorded.join(", ")}.`);
    console.error(`  ${relative(ROOT, REPLAY_TIMINGS_FILE)} is unchanged. Re-run once the run is clean.`);
  } else {
    writeFileSync(REPLAY_TIMINGS_FILE, `${JSON.stringify(measured(), null, 2)}\n`);
    console.log(`Recorded ${elapsed.size} page times in ${relative(ROOT, REPLAY_TIMINGS_FILE)}`);
    console.log("These only balance --shard. A stale figure costs wall clock, never coverage.");
  }
}
if (failed.length) {
  console.log(`\nfailing: ${failed.join(", ")}`);
  console.log("Each mismatch above names the first line that differs. The real output is the truth:");
  console.log("re-capture with scripts/adopt-real-output.ts once you've confirmed the command is right.");
  // Worth saying, because under the shared sandbox this was not true and the habit of doubting a
  // single-page run outlives the arrangement that justified it.
  console.log(`\nEach page ran in its own container, so this reproduces any of the above exactly:`);
  console.log(`  npm run replay -- ${failed[0]}`);
}
process.exit(failed.length === 0 ? 0 : 1);
