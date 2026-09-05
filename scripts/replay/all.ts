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
// setup script and on nothing else. See ADR-0020. The consequence worth knowing while reading a
// failure: a single-page run and a full run put a page in the identical container, so
// `npm run replay -- <page>` reproduces a batch failure exactly, and the order pages run in
// cannot change any result.
//
// The two replays are imported and called rather than spawned, so a serial run at least does not
// pay for a TypeScript startup per page.
//
// What this file keeps is the run itself. Deciding what was asked for is `lib/replayArgs.ts`,
// which pages a diff selects is `lib/changedPages.ts`, and owning the containers is
// `lib/replayContainers.ts`. Each of those is refusal logic worth testing without Docker.
//
// Exit status: 0 when every page reproduces, 1 if any page fails, 2 if Docker is
// unavailable or an argument names no page.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import {
  ReplayError,
  SANDBOX_FLAVOUR,
  readSetupDirectives,
  type SandboxFlavour,
} from "../lib/replayMetadata.js";
import { REPLAY_TIMINGS_FILE, ROOT, SANDBOX_SCRIPT, fixtureScript } from "../../src/paths.js";
import { replayCommandPage } from "./command-page.js";
import { replayProsePage } from "./prose-page.js";
import { shardCosts, shardPages } from "../lib/replayShard.js";
import { ArgumentError, type ReplayRequest, parseReplayArgs } from "../lib/replayArgs.js";
import { changedFiles, pagesTouchedBy } from "../lib/changedPages.js";
import { containerFor, sweepAbandoned } from "../lib/replayContainers.js";
import {
  ambiguousSlugs,
  commandPages,
  pageId,
  partitionBySetupScript,
  prosePages,
} from "../lib/replayPages.js";

/** Refuses a run whose pages cannot be told apart.
 *
 *  Before anything asks which page a slug means. A setup script names a slug and no category, so a
 *  slug two pages share cannot be attributed to either, and every page's cost, timing and estimate
 *  is stored per page. Refusing here beats a stack trace out of the shard partition, which is where
 *  this surfaces otherwise, several steps from the two files that caused it. */
function refuseAmbiguousSlugs(): void {
  const ambiguous = ambiguousSlugs();
  if (!ambiguous.length) return;
  console.error("replay: a setup script names a slug and no category, so these have one each and");
  console.error("  name two pages, and nothing can say which page the script belongs to:");
  console.error(`    ${ambiguous.join(", ")}`);
  console.error("  Rename one page of each pair, or drop the script.");
  process.exit(2);
}

/** The pages a run was asked for, before the setup-script filter.
 *
 *  Always a subset of `everyPage`, never the names as typed: that is what lets the caller spot a
 *  name matching no page and refuse, rather than reporting "nothing to replay" over a typo.
 *
 *  `--changed` falls back to everything when git cannot answer: a diff that failed to compute is
 *  not evidence that nothing needs checking. */
function selectPages(request: ReplayRequest, everyPage: string[]): string[] {
  if (!request.onlyChanged) {
    if (!request.pages.length) return everyPage;
    return everyPage.filter((page) => request.pages.includes(page));
  }

  let selected: string[] | "all";
  try {
    const base = process.env["REPLAY_DIFF_BASE"] ?? "origin/main";
    selected = pagesTouchedBy(changedFiles(base));
  } catch {
    console.error("replay --changed: could not diff; replaying everything instead.");
    return everyPage;
  }
  return selected === "all" ? everyPage : everyPage.filter((page) => selected.includes(page));
}

function requireDocker(): void {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
  } catch {
    console.error("replay needs Docker: the examples run inside a disposable container, never on this host.");
    process.exit(2);
  }
}

/** Sorted by name rather than by duration, so the diff between two recordings reads as "what
 *  changed" rather than as a reordering. */
function measured(elapsed: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...elapsed]
      .map(([name, seconds]) => [pageId(name), seconds] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function main(): void {
  let request: ReplayRequest;
  try {
    request = parseReplayArgs(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof ArgumentError)) throw error;
    console.error(error.message);
    process.exit(2);
  }
  const { shard } = request;

  refuseAmbiguousSlugs();

  // Prose pages state their claims as Markdown fences rather than YAML, so the two kinds run
  // through different replays. Both lists come from lib/replayPages.ts, which is also what the
  // timings check reads, so neither can start describing a different site from the other.
  const prose = prosePages();
  const isProse = (name: string): boolean => prose.includes(name);
  const everyPage = [...commandPages(), ...prose];

  const selected = selectPages(request, everyPage);
  const missing = request.pages.filter((name) => !selected.includes(name));
  if (missing.length) {
    console.error(`no such page: ${missing.join(", ")}`);
    process.exit(2);
  }

  // A page opts in to replay by having a setup script, and is otherwise reported rather than
  // passed over: "17/17 replayed" and "14 replayed, 3 have no fixtures" are different claims
  // about how much is checked. A page needing no sample files still gets one, holding only a
  // comment saying so: an explicit "nothing to create here" beats an absence that reads as an
  // oversight, and it keeps this gate meaningful instead of permanently red.
  const { replayable, unfixtured } = partitionBySetupScript(selected);
  // Sorted only so the report reads in a predictable order. Each page gets its own container, so
  // the order carries nothing else: it cannot change any page's result.
  const runnable = shardPages(replayable, shard, shardCosts(replayable)).sort();

  if (replayable.length === 0) {
    console.log(request.onlyChanged ? "no changed page has examples to replay." : "nothing to replay.");
    process.exit(0);
  }
  // An empty shard is a legitimate outcome, not an error: `--changed` over a small diff has fewer
  // pages than there are shards. Saying which shard was empty keeps a run that replayed nothing
  // distinguishable in the log from one that was never given anything.
  if (runnable.length === 0) {
    console.log(`shard ${shard.index}/${shard.total} has no pages of the ${replayable.length} to replay.`);
    process.exit(0);
  }

  requireDocker();

  // A page declaring `# verify: --systemd` needs a sandbox booted with systemd as PID 1, which
  // costs --privileged and the host's cgroup tree, so it is asked for per page rather than given
  // to every page.
  const flavourOf = (name: string): SandboxFlavour => readSetupDirectives(fixtureScript(name)).flavour;

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
    // The flag is the flavour, so a new one needs no case added here.
    const flavour = flavourOf(name);
    const startArgs = flavour === SANDBOX_FLAVOUR.default ? ["start"] : ["start", `--${flavour}`];
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

  if (request.timingsOut) {
    writeFileSync(request.timingsOut, `${JSON.stringify(measured(elapsed), null, 2)}\n`);
    console.log(`Wrote ${elapsed.size} page times to ${request.timingsOut}`);
  }

  if (request.recordTimings) {
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
      writeFileSync(REPLAY_TIMINGS_FILE, `${JSON.stringify(measured(elapsed), null, 2)}\n`);
      console.log(`Recorded ${elapsed.size} page times in ${relative(ROOT, REPLAY_TIMINGS_FILE)}`);
      console.log("These only balance --shard. A stale figure costs wall clock, never coverage.");
    }
  }
  if (failed.length) {
    console.log(`\nfailing: ${failed.join(", ")}`);
    console.log("Each mismatch above names the first line that differs. The real output is the truth:");
    console.log(
      "re-capture with scripts/authoring/adopt-real-output.ts once you've confirmed the command is right.",
    );
    console.log(`\nEach page ran in its own container, so this reproduces any of the above exactly:`);
    console.log(`  npm run replay -- ${failed[0]}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
