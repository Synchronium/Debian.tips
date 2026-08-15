#!/usr/bin/env node
// Replays every example on a command page inside the disposable sandbox and diffs the
// real output against what the page documents.
//
//   scripts/sandbox.sh start                     # once
//   node scripts/verify-examples.mjs [--user] <sandbox> <command> [setup.sh]
//
// --user runs everything as the unprivileged `user` instead of root. Pages about
// permissions need it: root bypasses the checks it documents, so `chmod 600 /etc/shadow`
// succeeds as root and can never print the "Operation not permitted" the page shows.
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

const argv = process.argv.slice(2);
const asUser = argv[0] === "--user" ? (argv.shift(), true) : false;
const [sandbox, command, setupPath] = argv;
if (!sandbox || !command) {
  console.error("usage: verify-examples.mjs [--user] <sandbox-name> <command> [setup.sh]");
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

// The `fixtures:` block is what a reader is shown as the sample data, so it has to agree
// with the setup script that actually creates it. Nothing forced that before: the replay
// proved a fixture right only indirectly, and only where some example's output happened
// to depend on it. Each fixture is re-read from the sandbox — `cat <name>` by default, or
// its `from:` command where the block isn't one file's contents — and diffed.
const fixtures = doc.fixtures ?? [];

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
// Fixtures are checked in the same batch as the examples, after them, so their indices
// continue the same marker sequence rather than needing a second pass over the sandbox.
const fixtureCommands = fixtures.map((f) => f.from ?? `cat ${shellQuote(f.name)}`);
const script = [
  // The container inherits umask 0000, which a real Debian system never has: a bare mkdir
  // gives a 777 directory and a bare touch gives 666. Pages that print modes documented
  // the normal 0022 behaviour, correctly, and failed against the artifact.
  "umask 0022",
  `cd ${WORKDIR}`,
  ...[...examples.map((ex) => ex.code), ...fixtureCommands].map(
    (code, i) => `${restore}\ncd ${WORKDIR}\nprintf '\\n${MARK}${i}\\n'\ntimeout 5 bash -c ${shellQuote(code)} 2>&1`,
  ),
].join("\n");

function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

const b64 = Buffer.from(script, "utf-8").toString("base64");
const run = (cmd, opts = {}) =>
  execFileSync(
    "scripts/sandbox.sh",
    ["exec", ...(opts.root || !asUser ? [] : ["-u", "user"]), sandbox, cmd],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );

// The working directory is created as root either way, so hand it over when the examples
// themselves run as `user` — otherwise the setup script can't write into it.
run(`rm -rf ${WORKDIR} && mkdir -p ${WORKDIR}${asUser ? ` && chown user:user ${WORKDIR}` : ""}`, { root: true });
if (setupPath) {
  const setup64 = Buffer.from(readFileSync(setupPath, "utf-8"), "utf-8").toString("base64");
  run(`cd ${WORKDIR} && echo ${setup64} | base64 -d > .setup.sh; echo setup-done`);
}

let raw = "";
try {
  raw = run(`echo ${b64} | base64 -d > /tmp/run-${command}.sh && bash /tmp/run-${command}.sh`);
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
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} +\d+ \d{2}:\d{2}:\d{2} \d{4}\b/g, "<TIMESTAMP>")
    // `tar -tvf`'s mtime column. Examples that archive a file they just created can only
    // ever stamp it "now", so the fixture pins what it can and this covers the rest.
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/g, "<TIMESTAMP>");

// `tar --totals` reports a transfer rate, which is a property of the machine and the
// moment, not of the command. The byte count either side of it still has to match.
const normRates = (s) => s.replace(/, \d+(\.\d+)?[KMG]iB\/s\)/g, ", <RATE>)");
// Examples run inside `bash -c`, which prefixes its diagnostics with the line number in
// that script ("bash: line 1: ./backup.sh: Permission denied"). An interactive shell
// prints no such prefix, so it's an artifact of the harness, not something to publish.
const normBashLine = (s) => s.replace(/^bash: line \d+: /gm, "bash: ");
const norm = (s) => normRates(normBashLine(normTimestamps(s.replace(/\s+$/gm, "").replace(/\n+$/, "").trim())));

let match = 0;
const differ = [];
examples.forEach((ex, i) => {
  const got = norm(actual.get(i) ?? "");
  const want = norm(ex.output);
  if (got === want) match++;
  else differ.push({ i, ex, got, want });
});

let fixtureMatch = 0;
const fixturesDiffer = [];
fixtures.forEach((f, n) => {
  const i = examples.length + n;
  const got = norm(actual.get(i) ?? "");
  const want = norm(f.content);
  if (got === want) fixtureMatch++;
  else fixturesDiffer.push({ i, name: f.name, cmd: fixtureCommands[n], got, want });
});

const skipNote = skipped.length ? ` (${skipped.length} not replayable in batch, see .skip file)` : "";
const fixtureNote = fixtures.length ? `, ${fixtureMatch}/${fixtures.length} fixtures` : "";
console.log(
  `\n${command}: ${match}/${examples.length} documented outputs reproduce exactly${fixtureNote}${skipNote}\n`,
);
for (const d of differ) {
  console.log(`--- [${d.i}] ${d.ex.title}`);
  console.log(`    $ ${d.ex.code.split("\n")[0]}`);
  console.log(`    want: ${JSON.stringify(d.want.slice(0, 160))}`);
  console.log(`    got : ${JSON.stringify(d.got.slice(0, 160))}`);
}
for (const d of fixturesDiffer) {
  console.log(`--- fixture "${d.name}" does not match what the setup script creates`);
  console.log(`    $ ${d.cmd}`);
  console.log(`    want: ${JSON.stringify(d.want.slice(0, 160))}`);
  console.log(`    got : ${JSON.stringify(d.got.slice(0, 160))}`);
}
process.exit(differ.length + fixturesDiffer.length === 0 ? 0 : 1);
