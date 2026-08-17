// Repairs `output:` blocks whose leading whitespace was lost.
//
//   npx tsx scripts/fix-output-whitespace.ts <sandbox> <command> [setup.sh]
//
// Commands that right-align columns (`wc`, `uniq -c`, `sort | uniq -c | sort -rn`) emit
// leading spaces that a plain YAML `|` block scalar silently strips: the block's
// indentation is taken from its first line, so any later line indented *less* is either
// an error or gets re-indented. The fix is an explicit indentation indicator (`|2`),
// which pins the strip width and lets individual lines keep their own padding.
//
// Deliberately narrow: only rewrites an example whose real output matches the documented
// output once leading whitespace is ignored on both sides. Anything that differs in
// substance is reported and left alone for a human — this is a formatting repair, not a
// way to make failing examples "pass".
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import type { Example, ExamplesFile } from "../src/content/schema.js";
import { findOutputBlock, replaceOutputBlock } from "./lib/yamlBlock.js";
import { shellQuote } from "./lib/replay.js";

const [sandbox, command, setupPath] = process.argv.slice(2);
if (!sandbox || !command) {
  console.error("usage: fix-output-whitespace.mjs <sandbox> <command> [setup.sh]");
  process.exit(2);
}

const path = `content/commands/${command}/examples.yaml`;
const doc = parse(readFileSync(path, "utf-8")) as ExamplesFile;
const examples: Example[] = [];
for (const section of doc.sections) {
  for (const ex of section.examples) if (ex.output !== undefined) examples.push(ex);
}

const WORKDIR = `/home/user/fix-${command}`;
const MARK = "@@EX@@";
const run = (cmd: string): string =>
  execFileSync("scripts/sandbox.sh", ["exec", sandbox, cmd], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });

run(`rm -rf ${WORKDIR} && mkdir -p ${WORKDIR}`);
if (setupPath) {
  const b = Buffer.from(readFileSync(setupPath, "utf-8"), "utf-8").toString("base64");
  run(`cd ${WORKDIR} && echo ${b} | base64 -d > s.sh && bash s.sh >/dev/null 2>&1; rm -f s.sh; echo ok`);
}
const script = [
  `cd ${WORKDIR}`,
  ...examples.map((ex, i) => `printf '\\n${MARK}${i}\\n'\ntimeout 5 bash -c ${shellQuote(ex.code)} 2>&1`),
].join("\n");
let raw = "";
try {
  raw = run(`echo ${Buffer.from(script, "utf-8").toString("base64")} | base64 -d > /tmp/r.sh && bash /tmp/r.sh`);
} catch (err) {
  raw = `${(err as { stdout?: string }).stdout ?? ""}`;
}
const parts = raw.split(new RegExp(`^${MARK}(\\d+)$`, "m"));
const actual = new Map<number, string>();
for (let i = 1; i < parts.length; i += 2) actual.set(Number(parts[i]), parts[i + 1] ?? "");

const stripTrailing = (s: string): string => s.replace(/\s+$/gm, "").replace(/^\n+|\n+$/g, "");
const ignoreLeading = (s: string): string =>
  stripTrailing(s)
    .split("\n")
    .map((line) => line.trimStart())
    .join("\n");

let lines = readFileSync(path, "utf-8").split("\n");
let fixed = 0;
const skipped: { title: string; code: string }[] = [];

for (let i = examples.length - 1; i >= 0; i--) {
  const ex = examples[i] as Example;
  const got = stripTrailing(actual.get(i) ?? "");
  const want = stripTrailing(ex.output ?? "");
  if (got === want) continue;
  if (ignoreLeading(got) !== ignoreLeading(want)) {
    skipped.push({ title: ex.title, code: ex.code.split("\n")[0] ?? "" });
    continue;
  }

  const lookup = findOutputBlock(lines, ex.title);
  if (!lookup.found) {
    const why = lookup.reason === "no-output-block" ? "(output block not found)" : `(title matches ${lookup.count} lines)`;
    skipped.push({ title: ex.title, code: why });
    continue;
  }
  lines = replaceOutputBlock(lines, lookup.block, got);
  fixed++;
}

writeFileSync(path, lines.join("\n"), "utf-8");
console.log(`${command}: repaired ${fixed} output block(s)`);
for (const s of skipped) console.log(`  LEFT ALONE (differs in substance): ${s.title} — ${s.code}`);
