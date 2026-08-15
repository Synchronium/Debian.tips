#!/usr/bin/env node
// Replays every example on a command page inside the disposable sandbox and diffs the
// real output against what the page documents.
//
//   scripts/sandbox.sh start                     # once
//   node scripts/verify-examples.mjs <sandbox> <command> [setup.sh]
//
// Examples with no `output:` are skipped (nothing to compare). `setup.sh`, if given, is
// run first inside the sandbox to create that page's fixture files.
//
// This exists because a page's `output:` blocks are its core promise — they're supposed
// to be real captured output, not written from memory. Replaying them is the only way to
// confirm that stays true, and it's what makes a `fixtures:` block trustworthy: if the
// documented fixture doesn't reproduce the documented output, one of them is wrong.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const [sandbox, command, setupPath] = process.argv.slice(2);
if (!sandbox || !command) {
  console.error("usage: verify-examples.mjs <sandbox-name> <command> [setup.sh]");
  process.exit(2);
}

const doc = parse(readFileSync(`content/commands/${command}/examples.yaml`, "utf-8"));

// Some examples genuinely can't be replayed in a batch — they need a concurrent writer
// (`tail -f`), a live log rotation, or a network peer. Those are listed by title in
// scripts/fixtures/<command>.skip, one per line, with a comment saying how they were
// verified instead. Everything not listed there must reproduce exactly.
let skipTitles = [];
try {
  skipTitles = readFileSync(`scripts/fixtures/${command}.skip`, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
} catch {
  /* no skip file: nothing is exempt */
}

const examples = [];
const skipped = [];
for (const section of doc.sections) {
  for (const ex of section.examples) {
    if (ex.output === undefined) continue;
    if (skipTitles.some((t) => ex.title.includes(t))) skipped.push(ex.title);
    else examples.push({ section: section.title, ...ex });
  }
}

// Each page gets its own empty directory. Sharing one working directory across pages
// silently corrupts any example that globs (`ls *.txt | wc -l`) or walks the tree
// (`find . -name '*.csv'`), because another page's fixtures show up in the results.
const WORKDIR = `/home/user/verify-${command}`;

const MARK = "@@EX@@";
// Every example runs under `timeout`: pages legitimately document blocking commands
// (`tail -f`, `journalctl -f`), and without this the whole run hangs on the first one.
// A timed-out example simply reports as a mismatch for a human to look at.
// The leading \n matters: plenty of commands emit output with no trailing newline
// (`tr -cd '0-9'`), which would otherwise run straight into the next marker and
// corrupt the parse for every example after it.
// Fixtures are restored before every example. Some examples legitimately mutate their
// input (`sort -u -o file file`, `sed -i`), and a reader picking any single example off
// the page expects the documented fixtures — not whatever an earlier example left behind.
const restore = setupPath ? `find ${WORKDIR} -mindepth 1 -not -name ".setup.sh" -delete 2>/dev/null; bash ${WORKDIR}/.setup.sh >/dev/null 2>&1` : "true";
const script = [
  `cd ${WORKDIR}`,
  ...examples.map(
    (ex, i) => `${restore}\ncd ${WORKDIR}\nprintf '\\n${MARK}${i}\\n'\ntimeout 5 bash -c ${shellQuote(ex.code)} 2>&1`,
  ),
].join("\n");

function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

const b64 = Buffer.from(script, "utf-8").toString("base64");
const run = (cmd) =>
  execFileSync("scripts/sandbox.sh", ["exec", sandbox, cmd], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });

run(`rm -rf ${WORKDIR} && mkdir -p ${WORKDIR}`);
if (setupPath) {
  const setup64 = Buffer.from(readFileSync(setupPath, "utf-8"), "utf-8").toString("base64");
  run(`cd ${WORKDIR} && echo ${setup64} | base64 -d > .setup.sh; echo setup-done`);
}

let raw = "";
try {
  raw = run(`echo ${b64} | base64 -d > /tmp/run.sh && bash /tmp/run.sh`);
} catch (err) {
  raw = `${err.stdout ?? ""}`;
}

const chunks = raw.split(new RegExp(`^${MARK}(\\d+)$`, "m"));
const actual = new Map();
for (let i = 1; i < chunks.length; i += 2) actual.set(Number(chunks[i]), (chunks[i + 1] ?? "").replace(/^\n/, ""));

// File mtimes appear in `diff -u`/`-c` headers and change on every run, so they're
// normalised on both sides — the same reason the style guide sanitises hostnames.
// Everything else must match byte for byte.
const normTimestamps = (s) =>
  s
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)? [+-]\d{4}/g, "<TIMESTAMP>")
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} +\d+ \d{2}:\d{2}:\d{2} \d{4}\b/g, "<TIMESTAMP>");
const norm = (s) => normTimestamps(s.replace(/\s+$/gm, "").replace(/\n+$/, "").trim());

let match = 0;
const differ = [];
examples.forEach((ex, i) => {
  const got = norm(actual.get(i) ?? "");
  const want = norm(ex.output);
  if (got === want) match++;
  else differ.push({ i, ex, got, want });
});

const skipNote = skipped.length ? ` (${skipped.length} not replayable in batch, see .skip file)` : "";
console.log(`\n${command}: ${match}/${examples.length} documented outputs reproduce exactly${skipNote}\n`);
for (const d of differ) {
  console.log(`--- [${d.i}] ${d.ex.title}`);
  console.log(`    $ ${d.ex.code.split("\n")[0]}`);
  console.log(`    want: ${JSON.stringify(d.want.slice(0, 160))}`);
  console.log(`    got : ${JSON.stringify(d.got.slice(0, 160))}`);
}
process.exit(differ.length === 0 ? 0 : 1);
