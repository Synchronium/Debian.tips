// Driving a disposable sandbox: running commands in it, installing a page's fixtures, and
// capturing what each example prints.
//
// Shared by every tool that runs an example, so all of them run one under identical conditions.
// A captured output is only comparable with a documented one if the two were produced the same
// way.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FIXTURE_DIR, SANDBOX_SCRIPT } from "../../src/paths.js";
import { ReplayError } from "./replayMetadata.js";

/** Seconds an example may run before `timeout` kills it. Pages document commands that
 *  block for ever (`tail -f`, `journalctl -f`); a timed-out example reports as a mismatch. */
export const EXAMPLE_TIMEOUT_SECONDS = 5;

/** Bytes kept per example. An interactive command that loops on EOF can emit hundreds of
 *  megabytes before `timeout` fires, overrunning the read buffer for the whole batch and
 *  leaving every later example reporting empty.
 *
 *  Applied with `head -c`, which counts bytes and will happily stop mid-character; the captured
 *  text is repaired to the last whole character on the way back (see `captureAll`), so a cap
 *  landing inside a multi-byte sequence reports as truncation rather than as a mismatch on a
 *  replacement character nobody can explain. */
export const OUTPUT_CAP_BYTES = 100_000;

/** Read buffer for one batch: every example's output arrives in a single string. */
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/** Separates one example's output from the next. Printed on its own line, preceded by a
 *  blank one, because plenty of commands emit output with no trailing newline. */
const MARKER = "@@EX@@";

/** Pinned rather than inherited: the umask a `docker exec` gets belongs to the host (0000
 *  on a docker-in-docker devcontainer, 0022 on a GitHub runner), and pages that print file
 *  modes have to see the same value everywhere. 0022 is what a Debian system gives. */
const UMASK = "0022";

/** Python helpers (the local HTTP server the curl and wget pages use) live here rather
 *  than in the working directory, which is wiped before every example. */
const HELPER_DIR = "/opt/mock";

/** Fixture bodies shared by several pages, sourced by absolute path from a setup script:
 *  the sandbox has no copy of this repository to source a relative one from. */
const SHARED_FIXTURES_LOCAL = join(FIXTURE_DIR, "_common.sh");
const SHARED_FIXTURES_IN_SANDBOX = "/tmp/fixtures-common.sh";

/** Printed by a setup script that ran to completion. */
const SETUP_OK = "__SETUP_OK__";

/** Single-quotes a string for `bash -c`. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface Sandbox {
  /** Runs a command inside the container. Runs as `user` when the page requires it,
   *  unless `asRoot` overrides that for a setup step. */
  exec(command: string, opts?: { asRoot?: boolean }): string;
  /** This tool's own directory inside the sandbox, empty at the start of a run. */
  readonly workdir: string;
  /** Shell snippet that empties the working directory and recreates the page's fixtures.
   *  Run before every example: some examples mutate their input (`sed -i`, `sort -o`), and
   *  each one is documented against the fixtures as the page shows them. */
  readonly restore: string;
}

/** How a sandbox is booted. `systemd` costs `--privileged` and the host's cgroup tree, so it is
 *  asked for per page — see `SETUP_DIRECTIVE` in `replayMetadata.ts` — rather than applied to
 *  everything. */
export const SANDBOX_FLAVOUR = { default: "default", systemd: "systemd" } as const;
export type SandboxFlavour = (typeof SANDBOX_FLAVOUR)[keyof typeof SANDBOX_FLAVOUR];

/** The tools that open a sandbox. The value names the tool's working directory inside the
 *  container, which is what keeps two of them running at once out of each other's files — so
 *  the set is named here rather than left to a string literal at each call site. */
export const SANDBOX_TOOL = {
  commandPage: "verify",
  prosePage: "prose",
  adopt: "adopt",
  fixWhitespace: "fix",
} as const;
export type SandboxTool = (typeof SANDBOX_TOOL)[keyof typeof SANDBOX_TOOL];

export interface OpenOptions {
  /** Container name from `scripts/sandbox.sh start`. */
  name: string;
  /** Page slug, e.g. "wget". */
  command: string;
  /** Names this tool's working directory, keeping concurrent tools out of each other's. */
  tool: SandboxTool;
  /** Run examples as the unprivileged `user` rather than root. */
  asUser: boolean;
  /** Require a sandbox booted with systemd as PID 1. */
  needsSystemd: boolean;
  /** The page's setup script. Without one, no fixtures are created and nothing is restored. */
  setupPath?: string | undefined;
}

/** Prepares a sandbox for one page: checks its init, creates an empty working directory,
 *  installs the Python helpers and shared fixture bodies, then runs the page's setup
 *  script once with its output visible.
 *
 *  Exits the process with a diagnostic rather than returning a broken sandbox. */
export function openSandbox(options: OpenOptions): Sandbox {
  const { name, command, tool, asUser, needsSystemd, setupPath } = options;
  const workdir = `/home/user/${tool}-${command}`;
  const setupInSandbox = `/tmp/setup-${command}.sh`;

  const exec = (cmd: string, opts: { asRoot?: boolean } = {}): string =>
    execFileSync(SANDBOX_SCRIPT, ["exec", ...(opts.asRoot || !asUser ? [] : ["-u", "user"]), name, cmd], {
      encoding: "utf-8",
      maxBuffer: MAX_BUFFER_BYTES,
    });

  if (needsSystemd) {
    const init = exec("cat /proc/1/comm", { asRoot: true }).trim();
    if (init !== SANDBOX_FLAVOUR.systemd) {
      throw new ReplayError(
        `${command} declares "# verify: --systemd" but ${name} is running "${init}" as PID 1.\n` +
          `Start one with: ${SANDBOX_SCRIPT} start --systemd`,
      );
    }
  }

  // Created as root, then handed over when the examples run as `user`.
  exec(`rm -rf ${workdir} && mkdir -p ${workdir}${asUser ? ` && chown user:user ${workdir}` : ""}`, {
    asRoot: true,
  });

  const helpers = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".py"));
  if (helpers.length) {
    exec(`mkdir -p ${HELPER_DIR}`, { asRoot: true });
    for (const helper of helpers) {
      writeFile(exec, join(FIXTURE_DIR, helper), `${HELPER_DIR}/${helper}`, { asRoot: true });
    }
  }

  if (!setupPath) return { exec, workdir, restore: "true" };

  // World-readable and root-owned: every page installs the identical file, and a page
  // running as `user` must never need to overwrite what a root one wrote.
  if (existsSync(SHARED_FIXTURES_LOCAL)) {
    writeFile(exec, SHARED_FIXTURES_LOCAL, SHARED_FIXTURES_IN_SANDBOX, { asRoot: true });
    exec(`chmod 644 ${SHARED_FIXTURES_IN_SANDBOX}`, { asRoot: true });
  }
  writeFile(exec, setupPath, setupInSandbox);

  // Run once with its output shown and its exit status honoured. The per-example restores
  // discard both, so without this a setup script that fails — a missing package, a port
  // already taken — is indistinguishable from a page whose every example is wrong.
  let setupOut = "";
  try {
    setupOut = exec(`cd ${workdir} && bash ${setupInSandbox} 2>&1 && echo ${SETUP_OK}`);
  } catch (err) {
    const failure = err as { stdout?: string; stderr?: string };
    setupOut = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
  }
  if (!setupOut.includes(SETUP_OK)) {
    throw new ReplayError(
      `${setupPath} failed inside the sandbox — no fixtures were created:\n${setupOut.trim()}`,
    );
  }

  return {
    exec,
    workdir,
    restore: `find ${workdir} -mindepth 1 -delete 2>/dev/null; bash ${setupInSandbox} >/dev/null 2>&1`,
  };
}

/** Runs each command in the sandbox and returns its output, keyed by position.
 *
 *  One batch rather than one `docker exec` per example: a page has fifty of them, and the
 *  per-call overhead dominates everything else. Each is preceded by a restore, given
 *  /dev/null on stdin so an interactive command can't consume the rest of the script, and
 *  capped. */
export function captureAll(sandbox: Sandbox, commands: string[]): Map<number, string> {
  const script = [
    `umask ${UMASK}`,
    `cd ${sandbox.workdir}`,
    ...commands.map((code, index) =>
      [
        sandbox.restore,
        `cd ${sandbox.workdir}`,
        `printf '\\n${MARKER}${index}\\n'`,
        `timeout ${EXAMPLE_TIMEOUT_SECONDS} bash -c ${shellQuote(code)} </dev/null 2>&1 | head -c ${OUTPUT_CAP_BYTES}`,
      ].join("\n"),
    ),
  ].join("\n");

  // Named for the tool and the page rather than for this process, so two tools sharing a
  // sandbox cannot overwrite each other's batch mid-run.
  const runner = `/tmp/batch-${sandbox.workdir.replace(/\//g, "-")}.sh`;
  let raw = "";
  try {
    raw = sandbox.exec(`echo ${base64(script)} | base64 -d > ${runner} && bash ${runner}`);
  } catch (err) {
    // A non-zero exit is normal: plenty of examples document a failing command.
    raw = `${(err as { stdout?: string }).stdout ?? ""}`;
  }

  const chunks = raw.split(new RegExp(`^${MARKER}(\\d+)$`, "m"));
  const output = new Map<number, string>();
  for (let i = 1; i < chunks.length; i += 2) {
    output.set(Number(chunks[i]), dropPartialCharacter((chunks[i + 1] ?? "").replace(/^\n/, "")));
  }
  return output;
}

/** Drops a trailing replacement character, which is what `head -c` leaves behind when the byte
 *  cap falls inside a multi-byte sequence. Comparing that against a page produces a mismatch on
 *  a character neither the page nor the command ever contained. */
function dropPartialCharacter(text: string): string {
  return text.replace(/\uFFFD$/, "");
}

/** Copies a local file into the sandbox, base64-encoded so no content needs quoting. */
function writeFile(
  exec: Sandbox["exec"],
  localPath: string,
  sandboxPath: string,
  opts: { asRoot?: boolean } = {},
): void {
  exec(`echo ${base64(readFileSync(localPath, "utf-8"))} | base64 -d > ${sandboxPath}`, opts);
}

function base64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}
