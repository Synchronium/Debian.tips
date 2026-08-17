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
import type { Example, ExamplesFile } from "../src/content/schema.js";
import { stripArtifacts } from "./lib/normalise.js";
import { loadSkipTitles, readSetupDirectives, shellQuote } from "./lib/replay.js";
import { findOutputBlock, replaceOutputBlock } from "./lib/yamlBlock.js";

const argv = process.argv.slice(2);
// Must mirror verify-examples.mjs: capturing as root when the page replays as `user`
// bakes "root root" into every ls -l on the page. Which mode a page needs is recorded in
// its setup script (`# verify: --user`), so both tools read it from the same place.
const asUserFlag = argv[0] === "--user" ? (argv.shift(), true) : false;
const [sandbox, command, setupPath, ...titles] = argv;
// setupPath is not optional here, unlike in verify-examples: adopt restores the fixtures
// before every example it captures, so without one it would record output produced against
// an empty directory. It used to fail on `undefined` with an ENOENT deep inside readFileSync
// rather than saying which argument was missing.
if (!sandbox || !command || !setupPath || titles.length === 0) {
  console.error('usage: adopt-real-output.ts [--user] <sandbox> <command> <setup.sh> "<title>"|--all');
  process.exit(2);
}
const directives = readSetupDirectives(setupPath);
const asUser = asUserFlag || directives.asUser;
const needsSystemd = directives.needsSystemd;

const path = `content/commands/${command}/examples.yaml`;
const doc = parse(readFileSync(path, "utf-8")) as ExamplesFile;

const withOutput = [];
for (const s of doc.sections) for (const ex of s.examples) if (ex.output !== undefined) withOutput.push(ex);
const skipTitles = loadSkipTitles(command, withOutput.map((ex) => ex.title));
const all = withOutput.filter((ex) => !skipTitles.has(ex.title));

const WORKDIR = `/home/user/adopt-${command}`;
const MARK = "@@EX@@";
const run = (cmd: string, opts: { root?: boolean } = {}): string =>
  execFileSync(
    "scripts/sandbox.sh",
    ["exec", ...(opts.root || !asUser ? [] : ["-u", "user"]), sandbox, cmd],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );

// A page that asks for `# verify: --systemd` must actually get a booted sandbox. Handing it
// the default one produces a page's worth of "System has not been booted with systemd as
// init system (PID 1)" — real output, reproducing nothing the page is about. Cheaper to
// refuse than to let the diff explain it fifty times.
if (needsSystemd) {
  const init = run("cat /proc/1/comm", { root: true }).trim();
  if (init !== "systemd") {
    console.error(
      `${command} declares "# verify: --systemd" but ${sandbox} is running "${init}" as PID 1.\n` +
        `Start one with: scripts/sandbox.sh start --systemd`,
    );
    process.exit(2);
  }
}

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
// which sources them by absolute path — as root and world-readable, so a page capturing
// as `user` never has to overwrite a file an earlier root run left behind.
const COMMON_SRC = "scripts/fixtures/_common.sh";
if (existsSync(COMMON_SRC)) {
  const common64 = Buffer.from(readFileSync(COMMON_SRC, "utf-8"), "utf-8").toString("base64");
  run(`echo ${common64} | base64 -d > /tmp/fixtures-common.sh && chmod 644 /tmp/fixtures-common.sh`, { root: true });
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
} catch (err) {
  raw = `${(err as { stdout?: string }).stdout ?? ""}`;
}
const parts = raw.split(new RegExp(`^${MARK}(\\d+)$`, "m"));
const actual = new Map<number, string>();
for (let i = 1; i < parts.length; i += 2) actual.set(Number(parts[i]), parts[i + 1] ?? "");

let lines = readFileSync(path, "utf-8").split("\n");

const claimed = new Set<number>();
for (const { ex, i } of [...targets].reverse()) {
  const got = stripArtifacts(actual.get(i) ?? "");
  if (!got) {
    console.log(`  SKIP (no output captured): ${ex.title}`);
    continue;
  }
  const lookup = findOutputBlock(lines, ex.title);
  if (!lookup.found) {
    if (lookup.reason === "no-output-block") {
      console.log(`  SKIP (no output block): ${ex.title}`);
      continue;
    }
    console.error(`  ABORT: ${JSON.stringify(ex.title)} matches ${lookup.count} title lines in ${path}`);
    process.exit(2);
  }
  if (claimed.has(lookup.block.keyLine)) {
    console.error(`  ABORT: two targets resolve to line ${lookup.block.keyLine + 1} of ${path}`);
    process.exit(2);
  }
  claimed.add(lookup.block.keyLine);
  lines = replaceOutputBlock(lines, lookup.block, got);
  console.log(`  adopted real output: ${ex.title}`);
}
writeFileSync(path, lines.join("\n"), "utf-8");
