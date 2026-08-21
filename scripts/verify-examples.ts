// Replays every example on a command page and diffs the real output against what the page
// documents.
//
//   scripts/sandbox.sh start                     # once
//   npx tsx scripts/verify-examples.ts [--user] <sandbox> <command> [setup.sh]
//
// A page's `output:` blocks are its central claim: real captured output, not written from
// memory. Replaying is the only thing that holds them to it, and it is what makes a
// `fixtures:` block worth showing — if the documented fixture doesn't reproduce the
// documented output, one of them is wrong.
//
// Examples with no `output:` are skipped, having nothing to compare. `--user` runs the
// examples as the unprivileged `user`; pages needing it declare `# verify: --user` in
// their setup script, so the command above is correct for every page.
//
// Exported as a function as well as a command: `npm run replay` calls `replayCommandPage`
// directly rather than spawning one `npx tsx` per page, which cost about half a second of
// TypeScript startup per page and dominated a batch of any size.
//
// Exit status: 0 when everything reproduces, 1 on any mismatch, 2 on a usage or setup error.
import { partitionExamples } from "../src/content/replayCounts.js";
import { COMPARISON } from "../src/content/schema.js";
import { readExamplesFile } from "./lib/examplesFile.js";
import { MASK_TOKENS, normalise, shapeOf } from "./lib/normalise.js";
import { ReplayError, loadSkipTitles, readSetupDirectives } from "./lib/replay.js";
import { firstDifference, scoreLine } from "./lib/report.js";
import { captureAll, openSandbox, shellQuote } from "./lib/sandbox.js";

export interface ReplayOptions {
  /** Container name from `scripts/sandbox.sh start`. */
  sandbox: string;
  /** Page slug, e.g. "wget". */
  command: string;
  /** The page's setup script, if it has one. */
  setupPath?: string | undefined;
  /** Manual override for a page whose setup script doesn't declare `# verify: --user`. */
  asUser?: boolean;
}

export interface ReplayResult {
  page: string;
  matched: number;
  total: number;
  mismatches: number;
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

  // Examples a batch can't reproduce — they need a concurrent writer, a live log rotation or
  // a network peer — are listed by title in scripts/fixtures/<command>.skip. Everything else
  // must reproduce exactly.
  //
  // The split comes from `partitionExamples`, which is also what the page's own "checks N
  // outputs" line is counted from and what /about/ sums. One partition, so the figure a reader
  // is shown and the figure this prints cannot drift apart. `loadSkipTitles` is still called,
  // for the check it makes rather than the set it returns: an entry naming an example that no
  // longer exists exempts nothing while reading as though it does, and that is a hard error.
  const { checked: examples, exempt: skipped } = partitionExamples(doc, command);
  const withOutput = [...examples, ...skipped];
  loadSkipTitles(
    command,
    withOutput.map((example) => example.title),
  );

  // A mask token is idempotent under masking, so a page carrying one matches any real output
  // for ever: the example would read as verified, count towards the score, and never fail
  // again. Masks belong to the comparison, never to a page.
  const documented = [
    ...withOutput.map((example) => ({ title: example.title, text: example.output ?? "" })),
    ...fixtures.map((fixture) => ({ title: `fixture "${fixture.name}"`, text: fixture.content })),
  ];
  const masked = documented.filter((entry) => MASK_TOKENS.some((token) => entry.text.includes(token)));
  if (masked.length) {
    throw new ReplayError(
      `${command}: ${masked.length} documented output(s) contain a normalisation mask, so they can never fail:\n` +
        masked.map((entry) => `  ${JSON.stringify(entry.title)}`).join("\n") +
        `\nRe-capture them with scripts/adopt-real-output.ts.`,
    );
  }

  const sandbox = openSandbox({
    name: sandboxName,
    command,
    tool: "verify",
    asUser,
    needsSystemd: directives.needsSystemd,
    setupPath,
  });

  // Fixtures are checked in the same batch, after the examples, so their indices continue the
  // same sequence. Each is re-read from the sandbox — `cat <name>` unless the block sets
  // `from:` — and diffed, so a fixtures: block that has drifted from its setup script fails
  // rather than quietly misleading a reader.
  const fixtureCommands = fixtures.map((fixture) => fixture.from ?? `cat ${shellQuote(fixture.name)}`);
  const captured = captureAll(sandbox, [...examples.map((example) => example.code), ...fixtureCommands]);

  // `compare: shape` relaxes the comparison for output carrying values no anchored mask
  // covers. Everything else — including most output declared `volatile:` — is compared
  // exactly, after the anchored masks in normalise.
  const mismatches: Mismatch[] = [];
  let exampleMatches = 0;
  let shapeMatches = 0;
  examples.forEach((example, index) => {
    const compare = example.compare === COMPARISON.shape ? shapeOf : normalise;
    const want = compare(example.output ?? "");
    const got = compare(captured.get(index) ?? "");
    if (want === got) {
      exampleMatches++;
      if (example.compare === COMPARISON.shape) shapeMatches++;
    } else {
      mismatches.push({
        index,
        title: example.compare === COMPARISON.shape ? `${example.title} (compared by shape)` : example.title,
        command: example.code.split("\n")[0] ?? "",
        want,
        got,
      });
    }
  });

  const fixtureMismatches: Mismatch[] = [];
  let fixtureMatches = 0;
  fixtures.forEach((fixture, n) => {
    const index = examples.length + n;
    const want = normalise(fixture.content);
    const got = normalise(captured.get(index) ?? "");
    if (want === got) fixtureMatches++;
    else {
      fixtureMismatches.push({
        index,
        title: `fixture "${fixture.name}" does not match what the setup script creates`,
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
      total: examples.length,
      shapeMatches,
      notes: [
        fixtures.length ? `, ${fixtureMatches}/${fixtures.length} fixtures` : "",
        skipped.length ? ` (${skipped.length} not replayable in batch, see .skip file)` : "",
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
    total: examples.length,
    mismatches: mismatches.length + fixtureMismatches.length,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const asUser = argv[0] === "--user" ? (argv.shift(), true) : false;
  const [sandbox, command, setupPath] = argv;
  if (!sandbox || !command) {
    console.error("usage: verify-examples.ts [--user] <sandbox-name> <command> [setup.sh]");
    process.exit(2);
  }

  try {
    const result = replayCommandPage({ sandbox, command, setupPath, asUser });
    process.exit(result.mismatches === 0 ? 0 : 1);
  } catch (error) {
    if (!(error instanceof ReplayError)) throw error;
    console.error(error.message);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
