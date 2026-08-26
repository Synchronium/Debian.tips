// Replaces the documented `output:` of named examples with their real captured output.
//
//   npx tsx scripts/adopt-real-output.ts [--user] <sandbox> <command> <setup.sh> "<title>"...
//   npx tsx scripts/adopt-real-output.ts [--user] <sandbox> <command> <setup.sh> --all
//
// This changes what a page claims, so it only touches examples named on the command line,
// or every example under `--all`. Use it when a page's output was written from memory or
// abridged, and the real output is the truth.
//
// What it writes is `stripArtifacts` output, never `normalise` output: the masks exist to
// compare two runs, and a page carrying one would read as a literal `<TIMESTAMP>` to a
// reader and match any future output for ever.
//
// A setup script is required, unlike in the replay: fixtures are restored before every
// example, and capturing against an empty directory would record nothing worth adopting.
import { readFileSync, writeFileSync } from "node:fs";
import { examplesPath, readExamplesFile } from "./lib/examplesFile.js";
import { stripArtifacts } from "./lib/normalise.js";
import { ReplayError, loadSkipTitles, readSetupDirectives } from "./lib/replayMetadata.js";
import { SANDBOX_TOOL, captureAll, openSandbox } from "./lib/sandbox.js";
import { findOutputBlock, replaceOutputBlock } from "./lib/yamlBlock.js";

function main(): void {
  const argv = process.argv.slice(2);
  const asUserFlag = argv[0] === "--user" ? (argv.shift(), true) : false;
  const [sandboxName, command, setupPath, ...titles] = argv;
  if (!sandboxName || !command || !setupPath || titles.length === 0) {
    console.error('usage: adopt-real-output.ts [--user] <sandbox> <command> <setup.sh> "<title>"|--all');
    process.exit(2);
  }

  // Capturing as root for a page that replays as `user` would bake "root root" into every
  // `ls -l` on it, so the mode is read from the same directive the replay reads.
  const directives = readSetupDirectives(setupPath);
  const asUser = asUserFlag || directives.asUser;

  const path = examplesPath(command);
  const doc = readExamplesFile(command);

  const withOutput = doc.sections.flatMap((section) =>
    section.examples.filter((example) => example.output !== undefined),
  );
  const skipTitles = loadSkipTitles(
    command,
    withOutput.map((example) => example.title),
  );
  const adoptable = withOutput.filter((example) => !skipTitles.has(example.title));

  // Titles are matched whole. A prefix match takes "Find symlinks" for "Find symlinks that
  // point to a regular file" and writes one example's output into the other's block.
  const wantAll = titles[0] === "--all";
  const targets = adoptable
    .map((example, index) => ({ example, index }))
    .filter(({ example }) => wantAll || titles.includes(example.title));
  if (!wantAll) {
    const missing = titles.filter((title) => !adoptable.some((example) => example.title === title));
    if (missing.length) {
      console.error(`no example titled: ${missing.map((title) => JSON.stringify(title)).join(", ")}`);
      process.exit(2);
    }
  }

  const sandbox = openSandbox({
    name: sandboxName,
    command,
    tool: SANDBOX_TOOL.adopt,
    asUser,
    needsSystemd: directives.needsSystemd,
    setupPath,
  });

  // Indexed by position in `adoptable`, so the captures line up with the targets whether or
  // not this is an --all run.
  const captured = captureAll(
    sandbox,
    adoptable.map((example) => example.code),
  );

  let lines = readFileSync(path, "utf-8").split("\n");
  // Rewritten last-first so each splice leaves the earlier line numbers intact.
  const claimed = new Set<number>();
  let adopted = 0;
  for (const { example, index } of [...targets].reverse()) {
    const output = stripArtifacts(captured.get(index) ?? "");
    if (!output) {
      console.log(`  SKIP (no output captured): ${example.title}`);
      continue;
    }

    const lookup = findOutputBlock(lines, example.title);
    if (!lookup.found) {
      if (lookup.reason === "no-output-block") {
        console.log(`  SKIP (no output block): ${example.title}`);
        continue;
      }
      console.error(
        `  ABORT: ${JSON.stringify(example.title)} matches ${lookup.count} title lines in ${path}`,
      );
      process.exit(2);
    }
    if (claimed.has(lookup.block.keyLine)) {
      console.error(`  ABORT: two targets resolve to line ${lookup.block.keyLine + 1} of ${path}`);
      process.exit(2);
    }

    claimed.add(lookup.block.keyLine);
    lines = replaceOutputBlock(lines, lookup.block, output);
    adopted++;
    // The numbers written for a volatile example are one machine's. Flagged rather than
    // silent: the `volatile:` note has to keep describing what actually varies.
    const note = example.volatile ? " (volatile: check the note still describes what varies)" : "";
    console.log(`  adopted real output: ${example.title}${note}`);
  }

  // Only when something changed: a run that adopted nothing should leave the file alone rather
  // than rewrite it with identical bytes and a new mtime.
  if (adopted > 0) writeFileSync(path, lines.join("\n"), "utf-8");
}

try {
  main();
} catch (error) {
  if (!(error instanceof ReplayError)) throw error;
  console.error(error.message);
  process.exit(2);
}
