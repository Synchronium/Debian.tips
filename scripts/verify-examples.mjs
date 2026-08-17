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
// Pages that need it say so themselves, with a `# verify: --user` line in their setup
// script, so the command above is correct for every page and the flag is never something
// you have to know in advance.
//
// Examples with no `output:` are skipped (nothing to compare). `setup.sh`, if given, is
// run first inside the sandbox to create that page's fixture files.
//
// This exists because a page's `output:` blocks are its core promise — they're supposed
// to be real captured output, not written from memory. Replaying them is the only way to
// confirm that stays true, and it's what makes a `fixtures:` block trustworthy: if the
// documented fixture doesn't reproduce the documented output, one of them is wrong.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { MASK_TOKENS, normalise } from "./lib/normalise.mjs";
import { loadSkipTitles, readSetupDirectives, shellQuote } from "./lib/replay.mjs";

const argv = process.argv.slice(2);
const asUserFlag = argv[0] === "--user" ? (argv.shift(), true) : false;
const [sandbox, command, setupPath] = argv;
if (!sandbox || !command) {
  console.error("usage: verify-examples.mjs [--user] <sandbox-name> <command> [setup.sh]");
  process.exit(2);
}

// The page's own setup script says how it has to be replayed; the flag is a manual
// override for a page that has no setup script yet.
const directives = readSetupDirectives(setupPath);
const asUser = asUserFlag || directives.asUser;
const needsSystemd = directives.needsSystemd;

const doc = parse(readFileSync(`content/commands/${command}/examples.yaml`, "utf-8"));

const withOutput = [];
for (const section of doc.sections) {
  for (const ex of section.examples) {
    if (ex.output !== undefined) withOutput.push({ section: section.title, ...ex });
  }
}

// Some examples genuinely can't be replayed in a batch — they need a concurrent writer
// (`tail -f`), a live log rotation, or a network peer. Those are listed by title in
// scripts/fixtures/<command>.skip, with a comment saying how they were verified instead.
// Everything not listed there must reproduce exactly.
const skipTitles = loadSkipTitles(command, withOutput.map((ex) => ex.title));
const examples = withOutput.filter((ex) => !skipTitles.has(ex.title));
const skipped = withOutput.filter((ex) => skipTitles.has(ex.title));

// A documented output must never contain one of the tokens `normalise()` uses to mask a
// volatile value. Those tokens are idempotent under masking, so a page carrying one
// matches *any* real output forever: the example reads as verified, is counted in the
// score, and can never fail again. Three curl blocks published `<VOLATILE>` to readers
// this way. Cheaper to refuse them here than to hope the next sweep spots them.
const masked = [...withOutput, ...(doc.fixtures ?? []).map((f) => ({ title: `fixture "${f.name}"`, output: f.content }))]
  .filter((ex) => MASK_TOKENS.some((token) => ex.output.includes(token)));
if (masked.length) {
  console.error(
    `${command}: ${masked.length} documented output(s) contain a normalisation mask, so they can never fail:\n` +
      masked.map((ex) => `  ${JSON.stringify(ex.title)}`).join("\n") +
      `\nRe-capture them with adopt-real-output.mjs — the mask belongs to the comparison, not to the page.`,
  );
  process.exit(2);
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
// Output is capped per example. `crontab -i -r` prompts, then loops on EOF, emitting
// 138MB in the five seconds before timeout kills it — enough to blow the read buffer and
// leave every later example reporting empty. A runaway example should fail alone.
// Every example gets /dev/null on stdin. An interactive one (`crontab -i -r` prompting
// for y/n) otherwise reads the rest of the generated script as its answers, and every
// example after it silently reports empty output.
// Every example runs under `timeout`: pages legitimately document blocking commands
// (`tail -f`, `journalctl -f`), and without this the whole run hangs on the first one.
// A timed-out example simply reports as a mismatch for a human to look at.
// The leading \n matters: plenty of commands emit output with no trailing newline
// (`tr -cd '0-9'`), which would otherwise run straight into the next marker and
// corrupt the parse for every example after it.
// Fixtures are restored before every example. Some examples legitimately mutate their
// input (`sort -u -o file file`, `sed -i`), and a reader picking any single example off
// the page expects the documented fixtures — not whatever an earlier example left behind.
// The setup script lives outside the working directory, not in it: an example that
// lists the directory (`find .`, `ls -a`) would otherwise show .setup.sh, and that
// harness internal would be adopted straight onto the page.
const SETUP = `/tmp/setup-${command}.sh`;
const COMMON_SRC = "scripts/fixtures/_common.sh";
const COMMON = "/tmp/fixtures-common.sh";
// Quiet for the per-example restores — a setup script that echoes would land in the
// middle of the next example's output. It is run once, loudly, before the batch instead
// (see `runSetupOnce` below), because a silently failing setup script produces a page's
// worth of mismatches with nothing to say that no fixture was ever created.
const restore = setupPath ? `find ${WORKDIR} -mindepth 1 -delete 2>/dev/null; bash ${SETUP} >/dev/null 2>&1` : "true";
// Fixtures are checked in the same batch as the examples, after them, so their indices
// continue the same marker sequence rather than needing a second pass over the sandbox.
const fixtureCommands = fixtures.map((f) => f.from ?? `cat ${shellQuote(f.name)}`);

const script = [
  // Pinned, because the umask a `docker exec` inherits is a property of the host: 0000 on
  // this project's devcontainer, 0022 on a GitHub runner. A real Debian system has neither
  // by accident, and pages that print modes documented the normal 0022 behaviour correctly
  // and failed against the artifact.
  "umask 0022",
  `cd ${WORKDIR}`,
  ...[...examples.map((ex) => ex.code), ...fixtureCommands].map(
    (code, i) => `${restore}\ncd ${WORKDIR}\nprintf '\\n${MARK}${i}\\n'\ntimeout 5 bash -c ${shellQuote(code)} </dev/null 2>&1 | head -c 100000`,
  ),
].join("\n");

const b64 = Buffer.from(script, "utf-8").toString("base64");
const run = (cmd, opts = {}) =>
  execFileSync(
    "scripts/sandbox.sh",
    ["exec", ...(opts.root || !asUser ? [] : ["-u", "user"]), sandbox, cmd],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );

// The working directory is created as root either way, so hand it over when the examples
// themselves run as `user` — otherwise the setup script can't write into it.
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
// Any Python helper in scripts/fixtures/ is installed into the sandbox before the setup
// script runs. http-mock.py is the local HTTP server the curl and wget pages exercise; it
// lives outside the working directory because that directory is wiped before every single
// example, and the server has to outlive them.
const helpers = readdirSync("scripts/fixtures").filter((f) => f.endsWith(".py"));
if (helpers.length) {
  run(`mkdir -p /opt/mock`, { root: true });
  for (const helper of helpers) {
    const encoded = Buffer.from(readFileSync(`scripts/fixtures/${helper}`, "utf-8"), "utf-8").toString("base64");
    run(`echo ${encoded} | base64 -d > /opt/mock/${helper}`, { root: true });
  }
}

if (setupPath) {
  // The fixture bodies several pages share. Installed next to the setup script rather than
  // in the working directory, which is wiped before every example, and by absolute path
  // because the sandbox has no copy of this repository to source a relative one from.
  //
  // Written as root and world-readable, once, because every page installs the identical
  // file: a page replaying as `user` must never need to overwrite what an earlier root
  // page wrote. Whether it *can* comes down to the umask `docker exec` happens to use,
  // which is 0000 on this devcontainer and 0022 on a GitHub runner — so the same command
  // passed locally and failed in CI on exactly the six pages that replay as `user`.
  if (existsSync(COMMON_SRC)) {
    const common64 = Buffer.from(readFileSync(COMMON_SRC, "utf-8"), "utf-8").toString("base64");
    run(`echo ${common64} | base64 -d > ${COMMON} && chmod 644 ${COMMON}`, { root: true });
  }
  const setup64 = Buffer.from(readFileSync(setupPath, "utf-8"), "utf-8").toString("base64");
  run(`echo ${setup64} | base64 -d > ${SETUP}`);
  // Run it once with its output visible and its exit status honoured. The per-example
  // restores discard both, which is right for them and wrong as the only run: a setup
  // script that fails — a missing package, a syntax error, a port already taken — is
  // otherwise indistinguishable from a page where every example is wrong.
  let setupOut = "";
  try {
    setupOut = run(`cd ${WORKDIR} && bash ${SETUP} 2>&1 && echo __SETUP_OK__`);
  } catch (err) {
    setupOut = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  if (!setupOut.includes("__SETUP_OK__")) {
    console.error(`${setupPath} failed inside the sandbox — no fixtures were created:\n${setupOut.trim()}`);
    process.exit(2);
  }
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

const norm = normalise;

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
// The mode is part of the result, not part of the invocation: the same page scores 42/42
// as `user` and 9/42 as root, so a score quoted without it means nothing.
console.log(
  `\n${command} (as ${asUser ? "user" : "root"}): ${match}/${examples.length} documented outputs reproduce exactly${fixtureNote}${skipNote}\n`,
);
/** The first line that differs, quoted so whitespace is visible. A fixed-length prefix of
 *  each side hid every difference that happened past the first 160 characters — which is
 *  most of them, since a mismatch is usually one line deep in an otherwise-correct
 *  block. Leading padding is exactly the kind of difference that has to be *visible* in
 *  the report, not implied. */
function firstDifference(want, got) {
  const w = want.split("\n");
  const g = got.split("\n");
  const n = Math.max(w.length, g.length);
  for (let i = 0; i < n; i++) {
    if (w[i] !== g[i]) {
      return [
        `    line ${i + 1} of ${n} differs:`,
        `      page: ${w[i] === undefined ? "(no such line)" : JSON.stringify(w[i])}`,
        `      real: ${g[i] === undefined ? "(no such line)" : JSON.stringify(g[i])}`,
      ].join("\n");
    }
  }
  return "    (identical line by line — a trailing-newline difference)";
}

for (const d of differ) {
  console.log(`--- [${d.i}] ${d.ex.title}`);
  console.log(`    $ ${d.ex.code.split("\n")[0]}`);
  console.log(firstDifference(d.want, d.got));
}
for (const d of fixturesDiffer) {
  console.log(`--- fixture "${d.name}" does not match what the setup script creates`);
  console.log(`    $ ${d.cmd}`);
  console.log(firstDifference(d.want, d.got));
}
process.exit(differ.length + fixturesDiffer.length === 0 ? 0 : 1);
