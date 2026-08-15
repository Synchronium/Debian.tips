#!/usr/bin/env node
// Replaces the documented `output:` of named examples with their real captured output.
//
//   node scripts/adopt-real-output.mjs <sandbox> <command> <setup.sh> "<title>" ["<title>" ...]
//
// Unlike fix-output-whitespace.mjs this *will* change output in substance, so it only
// touches examples named explicitly on the command line — never a blanket rewrite. Use it
// when the documented output was silently abridged and the real output is the truth.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";

const [sandbox, command, setupPath, ...titles] = process.argv.slice(2);
if (!sandbox || !command || titles.length === 0) {
  console.error('usage: adopt-real-output.mjs <sandbox> <command> <setup.sh> "<title>" ...');
  process.exit(2);
}

const path = `content/commands/${command}/examples.yaml`;
const doc = parse(readFileSync(path, "utf-8"));
const all = [];
for (const s of doc.sections) for (const ex of s.examples) if (ex.output !== undefined) all.push(ex);

const WORKDIR = `/home/user/adopt-${command}`;
const MARK = "@@EX@@";
const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const run = (cmd) =>
  execFileSync("scripts/sandbox.sh", ["exec", sandbox, cmd], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });

run(`rm -rf ${WORKDIR} && mkdir -p ${WORKDIR}`);
const setup64 = Buffer.from(readFileSync(setupPath, "utf-8"), "utf-8").toString("base64");
run(`cd ${WORKDIR} && echo ${setup64} | base64 -d > .setup.sh; echo ok`);
const restore = `find ${WORKDIR} -mindepth 1 -not -name ".setup.sh" -delete 2>/dev/null; bash ${WORKDIR}/.setup.sh >/dev/null 2>&1`;

const targets = all.map((ex, i) => ({ ex, i })).filter(({ ex }) => titles.some((t) => ex.title.includes(t)));
if (targets.length !== titles.length) console.log(`warning: matched ${targets.length} of ${titles.length} titles`);

const script = [
  `cd ${WORKDIR}`,
  ...targets.map(({ ex, i }) => `${restore}\ncd ${WORKDIR}\nprintf '\\n${MARK}${i}\\n'\ntimeout 5 bash -c ${q(ex.code)} 2>&1`),
].join("\n");
let raw = "";
try {
  raw = run(`echo ${Buffer.from(script, "utf-8").toString("base64")} | base64 -d > /tmp/a.sh && bash /tmp/a.sh`);
} catch (e) {
  raw = `${e.stdout ?? ""}`;
}
const parts = raw.split(new RegExp(`^${MARK}(\\d+)$`, "m"));
const actual = new Map();
for (let i = 1; i < parts.length; i += 2) actual.set(Number(parts[i]), parts[i + 1] ?? "");

let lines = readFileSync(path, "utf-8").split("\n");
for (const { ex, i } of [...targets].reverse()) {
  const got = (actual.get(i) ?? "").replace(/\s+$/gm, "").replace(/^\n+|\n+$/g, "");
  if (!got) { console.log(`  SKIP (no output captured): ${ex.title}`); continue; }
  const titleIdx = lines.findIndex((l) => l.includes("- title:") && l.includes(ex.title.slice(0, 40)));
  if (titleIdx === -1) { console.log(`  SKIP (title not found): ${ex.title}`); continue; }
  let outIdx = -1;
  for (let j = titleIdx; j < Math.min(titleIdx + 30, lines.length); j++) {
    if (/^\s+output: \|/.test(lines[j])) { outIdx = j; break; }
    if (j > titleIdx && lines[j].includes("- title:")) break;
  }
  if (outIdx === -1) { console.log(`  SKIP (no output block): ${ex.title}`); continue; }
  const keyIndent = lines[outIdx].match(/^(\s*)/)[1].length;
  let end = outIdx + 1;
  while (end < lines.length && (lines[end].trim() === "" || lines[end].search(/\S/) > keyIndent)) end++;
  const ind = " ".repeat(keyIndent + 2);
  lines.splice(outIdx, end - outIdx, `${" ".repeat(keyIndent)}output: |2`, ...got.split("\n").map((l) => (l === "" ? "" : ind + l)));
  console.log(`  adopted real output: ${ex.title}`);
}
writeFileSync(path, lines.join("\n"), "utf-8");
