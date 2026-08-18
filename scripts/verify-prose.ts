// Replays the documented output on one prose page — a concept, scripting lesson, recipe or
// Debian article — inside a sandbox, and diffs it against what the page claims.
//
//   npx tsx scripts/verify-prose.ts <sandbox> <slug> [scripts/fixtures/<slug>.sh]
//
// The counterpart to verify-examples.ts, which does the same for command pages. Those carry
// their examples as YAML; a prose page states the same claim as a ```bash fence followed by
// the output it produced, which scripts/lib/proseBlocks.ts pairs up.
//
// Without this, 96 output blocks across 15 pages were checked by nobody, and one of them had
// quietly drifted two Debian point releases out of date.
//
// Exit status: 0 when every pair reproduces, 1 on a mismatch, 2 on a bad argument.
import { existsSync } from "node:fs";
import { captureAll, openSandbox } from "./lib/sandbox.js";
import { PROSE_CATEGORIES } from "../src/content/schema.js";
import { fixtureScript, proseSource } from "../src/paths.js";
import { MASK_TOKENS, normalise, shapeOf } from "./lib/normalise.js";
import { parseProseFile, type ProsePair } from "./lib/proseBlocks.js";
import { readSetupDirectives } from "./lib/replay.js";

const [sandboxName, slug, setupArg] = process.argv.slice(2);
if (!sandboxName || !slug) {
  console.error("usage: verify-prose.ts <sandbox> <slug> [setup.sh]");
  process.exit(2);
}

const category = PROSE_CATEGORIES.find((name) => existsSync(proseSource(name, slug)));
if (!category) {
  console.error(`no prose page with slug "${slug}" (looked in ${PROSE_CATEGORIES.join(", ")})`);
  process.exit(2);
}
const pagePath = proseSource(category, slug);

const setupPath = setupArg ?? (existsSync(fixtureScript(slug)) ? fixtureScript(slug) : undefined);
const directives = setupPath ? readSetupDirectives(setupPath) : { asUser: false, needsSystemd: false };

const { pairs, unpaired } = parseProseFile(pagePath);
const runnable = pairs.filter((pair) => pair.comparison !== "skip");
const skipped = pairs.filter((pair) => pair.comparison === "skip");

// A mask token in a documented output would match any real output for ever, because the
// masks are idempotent. Same rule the command pages are held to.
for (const pair of pairs) {
  const token = MASK_TOKENS.find((mask) => pair.output.includes(mask));
  if (token) {
    console.error(`${pagePath}:${pair.line} documents the mask token ${token}, which would match anything.`);
    process.exit(2);
  }
}
const unexplained = skipped.find((pair) => !pair.note);
if (unexplained) {
  console.error(`${pagePath}:${unexplained.line} is skipped with no reason given.`);
  process.exit(2);
}

const sandbox = openSandbox({
  name: sandboxName,
  command: slug,
  tool: "prose",
  asUser: directives.asUser,
  needsSystemd: directives.needsSystemd,
  setupPath,
});

const captured = captureAll(sandbox, runnable.map((pair) => pair.command));

interface Mismatch {
  pair: ProsePair;
  want: string;
  got: string;
}

const mismatches: Mismatch[] = [];
let shapeMatches = 0;
let matches = 0;

runnable.forEach((pair, index) => {
  const compare = pair.comparison === "shape" ? shapeOf : normalise;
  const want = compare(pair.output);
  const got = compare(captured.get(index) ?? "");
  if (want === got) {
    matches++;
    if (pair.comparison === "shape") shapeMatches++;
  } else {
    mismatches.push({ pair, want, got });
  }
});

/** The first line that differs, quoted so leading and trailing spaces are visible. */
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

const howNote = shapeMatches ? ` (${matches - shapeMatches} exactly, ${shapeMatches} by shape)` : " exactly";
const skipNote = skipped.length ? `, ${skipped.length} skipped` : "";
// Unpaired blocks are claims nothing checked. Reported rather than failed: a config stanza
// is legitimately not command output, and the count is what tells an author which is which.
const unpairedNote = unpaired ? `, ${unpaired} block(s) not checkable` : "";
console.log(
  `\n${slug} (as ${directives.asUser ? "user" : "root"}): ${matches}/${runnable.length} documented outputs reproduce${howNote}${skipNote}${unpairedNote}\n`,
);

for (const mismatch of mismatches) {
  console.log(`--- ${pagePath}:${mismatch.pair.line}`);
  console.log(`    $ ${mismatch.pair.command.split("\n")[0]}`);
  console.log(firstDifference(mismatch.want, mismatch.got));
}

process.exit(mismatches.length === 0 ? 0 : 1);
