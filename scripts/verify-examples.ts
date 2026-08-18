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
// Exit status: 0 when everything reproduces, 1 on any mismatch, 2 on a usage or setup
// error.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Example, ExamplesFile } from "../src/content/schema.js";
import { MASK_TOKENS, normalise, shapeOf } from "./lib/normalise.js";
import { loadSkipTitles, readSetupDirectives } from "./lib/replay.js";
import { captureAll, openSandbox, shellQuote } from "./lib/sandbox.js";

const argv = process.argv.slice(2);
const asUserFlag = argv[0] === "--user" ? (argv.shift(), true) : false;
const [sandboxName, command, setupPath] = argv;
if (!sandboxName || !command) {
  console.error("usage: verify-examples.ts [--user] <sandbox-name> <command> [setup.sh]");
  process.exit(2);
}

// The page's setup script says how it has to be replayed; the flag is a manual override
// for a page that has no setup script yet.
const directives = readSetupDirectives(setupPath);
const asUser = asUserFlag || directives.asUser;

const examplesPath = `content/commands/${command}/examples.yaml`;
const doc = parse(readFileSync(examplesPath, "utf-8")) as ExamplesFile;
const fixtures = doc.fixtures ?? [];

/** An example plus the section it appears in, for the mismatch report. */
interface Replayed extends Example {
  section: string;
}

const withOutput: Replayed[] = [];
for (const section of doc.sections) {
  for (const example of section.examples) {
    if (example.output !== undefined) withOutput.push({ section: section.title, ...example });
  }
}

// Examples a batch can't reproduce — they need a concurrent writer, a live log rotation or
// a network peer — are listed by title in scripts/fixtures/<command>.skip. Everything else
// must reproduce exactly.
const skipTitles = loadSkipTitles(
  command,
  withOutput.map((example) => example.title),
);
const examples = withOutput.filter((example) => !skipTitles.has(example.title));
const skipped = withOutput.filter((example) => skipTitles.has(example.title));

// A mask token is idempotent under masking, so a page carrying one matches any real output
// for ever: the example would read as verified, count towards the score, and never fail
// again. Masks belong to the comparison, never to a page.
const documented = [
  ...withOutput.map((example) => ({ title: example.title, text: example.output ?? "" })),
  ...fixtures.map((fixture) => ({ title: `fixture "${fixture.name}"`, text: fixture.content })),
];
const masked = documented.filter((entry) => MASK_TOKENS.some((token) => entry.text.includes(token)));
if (masked.length) {
  console.error(
    `${command}: ${masked.length} documented output(s) contain a normalisation mask, so they can never fail:\n` +
      masked.map((entry) => `  ${JSON.stringify(entry.title)}`).join("\n") +
      `\nRe-capture them with scripts/adopt-real-output.ts.`,
  );
  process.exit(2);
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

interface Mismatch {
  index: number;
  title: string;
  command: string;
  want: string;
  got: string;
}

// `compare: shape` relaxes the comparison for output carrying values no anchored mask
// covers. Everything else — including most output declared `volatile:` — is compared
// exactly, after the anchored masks in normalise.
const mismatches: Mismatch[] = [];
let exampleMatches = 0;
let shapeMatches = 0;
examples.forEach((example, index) => {
  const compare = example.compare === "shape" ? shapeOf : normalise;
  const want = compare(example.output ?? "");
  const got = compare(captured.get(index) ?? "");
  if (want === got) {
    exampleMatches++;
    if (example.compare === "shape") shapeMatches++;
  } else {
    mismatches.push({
      index,
      title: example.compare === "shape" ? `${example.title} (compared by shape)` : example.title,
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

/** The first line that differs, quoted so leading and trailing spaces are visible.
 *  A mismatch is usually one line deep in an otherwise-correct block. */
function firstDifference(want: string, got: string): string {
  const wantLines = want.split("\n");
  const gotLines = got.split("\n");
  const total = Math.max(wantLines.length, gotLines.length);
  for (let i = 0; i < total; i++) {
    if (wantLines[i] === gotLines[i]) continue;
    const show = (line: string | undefined) => (line === undefined ? "(no such line)" : JSON.stringify(line));
    return [
      `    line ${i + 1} of ${total} differs:`,
      `      page: ${show(wantLines[i])}`,
      `      real: ${show(gotLines[i])}`,
    ].join("\n");
  }
  return "    (identical line by line — a trailing-newline difference)";
}

const fixtureNote = fixtures.length ? `, ${fixtureMatches}/${fixtures.length} fixtures` : "";
// "Reproduces exactly" is a stronger claim than "has the same shape", so the two are
// counted in the same total but never described as the same thing.
const howNote = shapeMatches
  ? ` (${exampleMatches - shapeMatches} exactly, ${shapeMatches} by shape)`
  : " exactly";
const skipNote = skipped.length ? ` (${skipped.length} not replayable in batch, see .skip file)` : "";
// The mode is part of the result: the same page scores 42/42 as `user` and 9/42 as root, so
// a score quoted without it means nothing.
console.log(
  `\n${command} (as ${asUser ? "user" : "root"}): ${exampleMatches}/${examples.length} documented outputs reproduce${howNote}${fixtureNote}${skipNote}\n`,
);

for (const mismatch of [...mismatches, ...fixtureMismatches]) {
  console.log(`--- [${mismatch.index}] ${mismatch.title}`);
  console.log(`    $ ${mismatch.command}`);
  console.log(firstDifference(mismatch.want, mismatch.got));
}

process.exit(mismatches.length + fixtureMismatches.length === 0 ? 0 : 1);
