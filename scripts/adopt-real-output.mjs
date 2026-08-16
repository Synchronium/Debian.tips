#!/usr/bin/env node
// Replaces the documented `output:` of named examples with their real captured output.
//
//   node scripts/adopt-real-output.mjs <sandbox> <command> <setup.sh> "<title>" ["<title>" ...]
//
// Unlike fix-output-whitespace.mjs this *will* change output in substance, so it only
// touches examples named explicitly on the command line — never a blanket rewrite. Use it
// when the documented output was silently abridged and the real output is the truth.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { stripArtifacts } from "./lib/normalise.mjs";
import { loadSkipTitles, readSetupDirectives, shellQuote } from "./lib/replay.mjs";

const argv = process.argv.slice(2);
// Must mirror verify-examples.mjs: capturing as root when the page replays as `user`
// bakes "root root" into every ls -l on the page. Which mode a page needs is recorded in
// its setup script (`# verify: --user`), so both tools read it from the same place.
const asUserFlag = argv[0] === "--user" ? (argv.shift(), true) : false;
const [sandbox, command, setupPath, ...titles] = argv;
if (!sandbox || !command || titles.length === 0) {
  console.error('usage: adopt-real-output.mjs [--user] <sandbox> <command> <setup.sh> "<title>"|--all');
  process.exit(2);
}
const asUser = asUserFlag || readSetupDirectives(setupPath).asUser;

const path = `content/commands/${command}/examples.yaml`;
const doc = parse(readFileSync(path, "utf-8"));

const withOutput = [];
for (const s of doc.sections) for (const ex of s.examples) if (ex.output !== undefined) withOutput.push(ex);
const skipTitles = loadSkipTitles(command, withOutput.map((ex) => ex.title));
const all = withOutput.filter((ex) => !skipTitles.has(ex.title));

const WORKDIR = `/home/user/adopt-${command}`;
const MARK = "@@EX@@";
const run = (cmd, opts = {}) =>
  execFileSync(
    "scripts/sandbox.sh",
    ["exec", ...(opts.root || !asUser ? [] : ["-u", "user"]), sandbox, cmd],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );

run(`rm -rf ${WORKDIR} && mkdir -p ${WORKDIR}${asUser ? ` && chown user:user ${WORKDIR}` : ""}`, { root: true });
// Mirrors verify-examples.mjs: any Python helper in scripts/fixtures/ is installed into
// the sandbox before the setup script runs, outside the working directory that is wiped
// between examples.
const helpers = readdirSync("scripts/fixtures").filter((f) => f.endsWith(".py"));
if (helpers.length) {
  run(`mkdir -p /opt/mock`, { root: true });
  for (const helper of helpers) {
    const encoded = Buffer.from(readFileSync(`scripts/fixtures/${helper}`, "utf-8"), "utf-8").toString("base64");
    run(`echo ${encoded} | base64 -d > /opt/mock/${helper}`, { root: true });
  }
}

const SETUP = `/tmp/setup-${command}.sh`;
// Mirrors verify-examples.mjs: the shared fixture bodies go in beside the setup script,
// which sources them by absolute path.
const COMMON_SRC = "scripts/fixtures/_common.sh";
if (existsSync(COMMON_SRC)) {
  const common64 = Buffer.from(readFileSync(COMMON_SRC, "utf-8"), "utf-8").toString("base64");
  run(`echo ${common64} | base64 -d > /tmp/fixtures-common.sh`);
}
const setup64 = Buffer.from(readFileSync(setupPath, "utf-8"), "utf-8").toString("base64");
run(`echo ${setup64} | base64 -d > ${SETUP}; echo ok`);
const restore = `find ${WORKDIR} -mindepth 1 -delete 2>/dev/null; bash ${SETUP} >/dev/null 2>&1`;

// Exact titles, not substrings: "Find symlinks" is also a prefix of "Find symlinks that
// point to a regular file", and a loose match silently adopts the wrong example's output
// into the wrong block. Pass --all to take every example's real output instead.
const wantAll = titles[0] === "--all";
const targets = all
  .map((ex, i) => ({ ex, i }))
  .filter(({ ex }) => (wantAll ? true : titles.includes(ex.title)));
if (!wantAll) {
  const missing = titles.filter((t) => !all.some((ex) => ex.title === t));
  if (missing.length) {
    console.error(`no example titled: ${missing.map((t) => JSON.stringify(t)).join(", ")}`);
    process.exit(2);
  }
}

const script = [
  "umask 0022",
  `cd ${WORKDIR}`,
  // Capped exactly as verify-examples.mjs caps it: `crontab -i -r` prompts, loops on EOF
  // and emits 138MB in five seconds. Uncapped, that overruns maxBuffer, gets swallowed by
  // the catch below, and a truncated capture is written onto the page.
  ...targets.map(({ ex, i }) => `${restore}\ncd ${WORKDIR}\nprintf '\\n${MARK}${i}\\n'\ntimeout 5 bash -c ${shellQuote(ex.code)} </dev/null 2>&1 | head -c 100000`),
].join("\n");
let raw = "";
try {
  raw = run(`echo ${Buffer.from(script, "utf-8").toString("base64")} | base64 -d > /tmp/adopt-${command}.sh && bash /tmp/adopt-${command}.sh`);
} catch (e) {
  raw = `${e.stdout ?? ""}`;
}
const parts = raw.split(new RegExp(`^${MARK}(\\d+)$`, "m"));
const actual = new Map();
for (let i = 1; i < parts.length; i += 2) actual.set(Number(parts[i]), parts[i + 1] ?? "");

let lines = readFileSync(path, "utf-8").split("\n");

/** The title a `- title:` line declares, or null for any other line. Parsed as YAML
 *  rather than string-matched, so quoting and escapes are the file's business.
 *
 *  Selecting *which* examples to adopt was fixed to exact matching long before this was:
 *  finding the line to write to still took the first line containing the title's first
 *  40 characters, which on the grep page resolved "Count matches per file" to the block
 *  belonging to "Count matches per file across a whole tree" — overwriting one example's
 *  real capture with another's. */
const titleAt = (line) => {
  const m = /^\s*- title:\s*(.*\S)\s*$/.exec(line);
  if (!m) return null;
  try {
    return parse(m[1]);
  } catch {
    return null;
  }
};

const claimed = new Set();
for (const { ex, i } of [...targets].reverse()) {
  const got = stripArtifacts(actual.get(i) ?? "");
  if (!got) { console.log(`  SKIP (no output captured): ${ex.title}`); continue; }
  const matches = lines.map((l, n) => (titleAt(l) === ex.title ? n : -1)).filter((n) => n !== -1);
  if (matches.length !== 1) {
    console.error(`  ABORT: ${JSON.stringify(ex.title)} matches ${matches.length} title lines in ${path}`);
    process.exit(2);
  }
  const titleIdx = matches[0];
  if (claimed.has(titleIdx)) {
    console.error(`  ABORT: two targets resolve to line ${titleIdx + 1} of ${path}`);
    process.exit(2);
  }
  claimed.add(titleIdx);
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
