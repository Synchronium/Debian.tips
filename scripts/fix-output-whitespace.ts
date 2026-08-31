// Repairs `output:` blocks whose leading whitespace was lost.
//
//   npx tsx scripts/fix-output-whitespace.ts [--user] <sandbox> <command> [setup.sh]
//
// Commands that right-align columns (`wc`, `uniq -c`) emit leading spaces that a plain YAML
// `|` block silently strips: the block takes its indentation from its first line, so any
// later line indented less is re-indented or rejected. The repair is to rewrite the block
// with an explicit `|2` indicator, which pins the strip width and lets each line keep its
// own padding.
//
// Deliberately narrow. It only rewrites an example whose real output matches the documented
// output once leading whitespace is ignored on both sides; anything differing in substance
// is reported and left for a human. This is a formatting repair, not a way to make a wrong
// example pass; use adopt-real-output.ts for that, deliberately.
import { readFileSync, writeFileSync } from "node:fs";
import type { Example } from "../src/content/schema.js";
import { examplesPath, readExamplesFile } from "./lib/examplesFile.js";
import { ReplayError, readSetupDirectives } from "./lib/replayMetadata.js";
import { SANDBOX_TOOL, captureAll, openSandbox } from "./lib/sandbox.js";
import { findOutputBlock, replaceOutputBlock } from "./lib/yamlBlock.js";

function main(): void {
  const argv = process.argv.slice(2);
  const asUserFlag = argv[0] === "--user" ? (argv.shift(), true) : false;
  const [sandboxName, command, setupPath] = argv;
  if (!sandboxName || !command) {
    console.error("usage: fix-output-whitespace.ts [--user] <sandbox> <command> [setup.sh]");
    process.exit(2);
  }

  const directives = readSetupDirectives(setupPath);
  const asUser = asUserFlag || directives.asUser;

  const path = examplesPath(command);
  const doc = readExamplesFile(command);
  const examples: Example[] = doc.sections.flatMap((section) =>
    section.examples.filter((example) => example.output !== undefined),
  );

  const sandbox = openSandbox({
    name: sandboxName,
    command,
    tool: SANDBOX_TOOL.fixWhitespace,
    asUser,
    flavour: directives.flavour,
    setupPath,
  });
  const captured = captureAll(
    sandbox,
    examples.map((example) => example.code),
  );

  /** Trailing spaces per line, and leading and trailing blank lines.
   *
   *  Deliberately narrower than the replay's `normalise`: this tool decides whether two blocks
   *  differ *only* in indentation, so anything it cannot explain that way must be left alone. A
   *  looser comparison here would let it rewrite a block that genuinely differs. */
  const trimEdges = (text: string): string => text.replace(/[ \t\r]+$/gm, "").replace(/^\n+|\n+$/g, "");

  /** Comparable ignoring the indentation this tool exists to restore. */
  const withoutIndentation = (text: string): string =>
    trimEdges(text)
      .split("\n")
      .map((line) => line.trimStart())
      .join("\n");

  let lines = readFileSync(path, "utf-8").split("\n");
  let repaired = 0;
  const leftAlone: { title: string; reason: string }[] = [];

  // Rewritten last-first so each splice leaves the earlier line numbers intact.
  for (let index = examples.length - 1; index >= 0; index--) {
    const example = examples[index] as Example;
    const got = trimEdges(captured.get(index) ?? "");
    const want = trimEdges(example.output ?? "");
    if (got === want) continue;

    if (withoutIndentation(got) !== withoutIndentation(want)) {
      leftAlone.push({ title: example.title, reason: example.code.split("\n")[0] ?? "" });
      continue;
    }

    const lookup = findOutputBlock(lines, example.title);
    if (!lookup.found) {
      const reason =
        lookup.reason === "no-output-block"
          ? "(output block not found)"
          : `(title matches ${lookup.count} lines)`;
      leftAlone.push({ title: example.title, reason });
      continue;
    }

    lines = replaceOutputBlock(lines, lookup.block, got);
    repaired++;
  }

  writeFileSync(path, lines.join("\n"), "utf-8");
  console.log(`${command}: repaired ${repaired} output block(s)`);
  for (const entry of leftAlone)
    console.log(`  LEFT ALONE (differs in substance): ${entry.title}: ${entry.reason}`);
}

try {
  main();
} catch (error) {
  if (!(error instanceof ReplayError)) throw error;
  console.error(error.message);
  process.exit(2);
}
