// Replays every example on a command page and diffs the real output against what the page
// documents.
//
//   scripts/replay/sandbox.sh start                     # once
//   npx tsx scripts/replay/command-page.ts [--user] <sandbox> <command> [setup.sh]
//
// A page's `output:` blocks are its central claim: real captured output, not written from
// memory. Replaying is the only thing that holds them to it, and it is what makes a
// `fixtures:` block worth showing: if the documented fixture doesn't reproduce the
// documented output, one of them is wrong.
//
// Examples with no `output:` are skipped, having nothing to compare. `--user` runs the
// examples as the unprivileged `user`; pages needing it declare `# verify: --user` in
// their setup script, so the command above is correct for every page.
//
// Exported as a function as well as a command: `npm run replay` calls `replayCommandPage`
// directly rather than spawning one `npx tsx` per page, which costs about half a second of
// TypeScript startup each and dominates a batch of any size.
//
// Exit status: 0 when everything reproduces, 1 on any mismatch, 2 on a usage or setup error.
import { partitionExamples } from "../../src/content/pageChecks.js";
import { COMPARISON, type Comparison } from "../../src/content/schema.js";
import { readExamplesFile } from "../lib/examplesFile.js";
import { lineOrderIgnored, normalise, refuseMaskTokens, shapeOf } from "../lib/normalise.js";
import { loadSkipTitles, readSetupDirectives } from "../lib/replayMetadata.js";
import { type ReplayResult, firstDifference, runAsCommand, scoreLine } from "../lib/replayReport.js";
import { SANDBOX_TOOL, captureAll, openSandbox, shellQuote } from "../lib/sandbox.js";

/** How one example or fixture block is reduced before its two sides are compared, and what to
 *  call that in a mismatch report.
 *
 *  `compare:` decides how a line is read and `unordered:` whether the sequence of those lines
 *  counts, so the reduction runs per line and then over the order.
 *
 *  A mismatch has to name whichever was applied. What gets printed after either is not quite what
 *  ran: a masked side shows `0` where a number was, and a sorted one shows the lines in an order
 *  the command never printed. Without the label, someone reading the diff goes looking for a
 *  defect in the ordering.
 *
 *  A fixture block has no `compare:` of its own, so it takes the default and only `unordered:`
 *  reaches this. Typed structurally rather than as `Example | Fixture` for that reason. */
function comparerFor(block: { compare?: Comparison | undefined; unordered?: boolean | undefined }): {
  reduce: (text: string) => string;
  relaxation: string;
} {
  const perLine = block.compare === COMPARISON.shape ? shapeOf : normalise;
  const reduce = block.unordered ? (text: string) => lineOrderIgnored(perLine(text)) : perLine;
  const named = [
    block.compare === COMPARISON.shape ? "by shape" : "",
    block.unordered ? "in any line order" : "",
  ].filter((name) => name !== "");
  return { reduce, relaxation: named.length === 0 ? "" : ` (compared ${named.join(", ")})` };
}

export interface ReplayOptions {
  /** Container name from `scripts/replay/sandbox.sh start`. */
  sandbox: string;
  /** Page slug, e.g. "wget". */
  command: string;
  /** The page's setup script, if it has one. */
  setupPath?: string | undefined;
  /** Manual override for a page whose setup script doesn't declare `# verify: --user`. */
  asUser?: boolean;
}

interface Mismatch {
  index: number;
  title: string;
  command: string;
  want: string;
  got: string;
}

export function replayCommandPage(options: ReplayOptions): ReplayResult {
  const { sandbox: sandboxName, command, setupPath } = options;

  // The page's setup script says how it has to be replayed; the flag is a manual override
  // for a page that has no setup script yet.
  const directives = readSetupDirectives(setupPath);
  const asUser = options.asUser === true || directives.asUser;

  const doc = readExamplesFile(command);
  const fixtures = doc.fixtures ?? [];

  // Examples a batch can't reproduce, because they need a concurrent writer, a live log
  // rotation or a network peer, are listed by title in scripts/fixtures/<command>.skip. Everything else
  // must reproduce exactly.
  //
  // The split comes from `partitionExamples`, which is also what the page's own "checks N
  // outputs" line is counted from and what /about/ sums. One partition, so the figure a reader
  // is shown and the figure this prints cannot drift apart. `loadSkipTitles` is called for the
  // check it makes rather than the set it returns: an entry naming an example that no longer
  // exists exempts nothing while reading as though it does, and that is a hard error.
  const { checked, exempt } = partitionExamples(doc, command);
  const documentedOutputs = [...checked, ...exempt];
  loadSkipTitles(
    command,
    documentedOutputs.map((example) => example.title),
  );

  // The fixtures are held to this as well as the outputs: a fixture block is presented to the
  // reader as the file's real contents, and a mask in one would render as a literal placeholder.
  refuseMaskTokens(command, [
    ...documentedOutputs.map((example) => ({
      where: JSON.stringify(example.title),
      text: example.output ?? "",
    })),
    ...fixtures.map((fixture) => ({
      where: `fixture ${JSON.stringify(fixture.name)}`,
      text: fixture.content,
    })),
  ]);

  const sandbox = openSandbox({
    name: sandboxName,
    command,
    tool: SANDBOX_TOOL.commandPage,
    asUser,
    flavour: directives.flavour,
    setupPath,
  });

  // Fixtures are checked in the same batch, after the examples, so their indices continue the
  // same sequence. Each is re-read from the sandbox (`cat <name>` unless the block sets
  // `from:`) and diffed, so a fixtures: block that has drifted from its setup script fails
  // rather than quietly misleading a reader.
  const fixtureCommands = fixtures.map((fixture) => fixture.from ?? `cat ${shellQuote(fixture.name)}`);
  const captured = captureAll(sandbox, [...checked.map((example) => example.code), ...fixtureCommands]);

  // `compare: shape` relaxes the comparison for output carrying values no anchored mask covers,
  // and `unordered:` for output whose line order the command does not fix. Everything else,
  // including most output declared `volatile:`, is compared exactly after the anchored masks in
  // normalise.
  const mismatches: Mismatch[] = [];
  let exampleMatches = 0;
  let shapeMatches = 0;
  let unorderedMatches = 0;
  checked.forEach((example, index) => {
    const { reduce, relaxation } = comparerFor(example);
    const want = reduce(example.output ?? "");
    const got = reduce(captured.get(index) ?? "");
    if (want === got) {
      exampleMatches++;
      if (example.compare === COMPARISON.shape) shapeMatches++;
      else if (example.unordered === true) unorderedMatches++;
    } else {
      mismatches.push({
        index,
        title: `${example.title}${relaxation}`,
        command: example.code.split("\n")[0] ?? "",
        want,
        got,
      });
    }
  });

  const fixtureMismatches: Mismatch[] = [];
  let fixtureMatches = 0;
  fixtures.forEach((fixture, n) => {
    const index = checked.length + n;
    const { reduce, relaxation } = comparerFor(fixture);
    const want = reduce(fixture.content);
    const got = reduce(captured.get(index) ?? "");
    if (want === got) fixtureMatches++;
    else {
      fixtureMismatches.push({
        index,
        title: `fixture "${fixture.name}" does not match what the setup script creates${relaxation}`,
        command: fixtureCommands[n] ?? "",
        want,
        got,
      });
    }
  });

  console.log(
    scoreLine({
      page: command,
      asUser,
      matched: exampleMatches,
      total: checked.length,
      shapeMatches,
      unorderedMatches,
      notes: [
        fixtures.length ? `, ${fixtureMatches}/${fixtures.length} fixtures` : "",
        exempt.length ? ` (${exempt.length} not replayable in batch, see .skip file)` : "",
      ],
    }),
  );

  for (const mismatch of [...mismatches, ...fixtureMismatches]) {
    console.log(`--- [${mismatch.index}] ${mismatch.title}`);
    console.log(`    $ ${mismatch.command}`);
    console.log(firstDifference(mismatch.want, mismatch.got));
  }

  return {
    page: command,
    matched: exampleMatches,
    total: checked.length,
    mismatches: mismatches.length + fixtureMismatches.length,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const asUser = argv[0] === "--user" ? (argv.shift(), true) : false;
  const [sandbox, command, setupPath] = argv;
  if (!sandbox || !command) {
    console.error("usage: command-page.ts [--user] <sandbox-name> <command> [setup.sh]");
    process.exit(2);
  }
  runAsCommand(() => replayCommandPage({ sandbox, command, setupPath, asUser }));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
