// Reading a page's replay metadata: which examples are exempt from the batch, and how the
// page has to be run.
import { readFileSync } from "node:fs";
import { readSkipEntries } from "../../src/content/replaySkips.js";

/** A page cannot be replayed as asked: a stale exemption, an unknown directive, a sandbox that
 *  is not what the page needs. Thrown rather than exiting, so the batch runner can report the
 *  page and carry on with the rest — and so these tools can be called as functions at all. */
export class ReplayError extends Error {}

/** Titles listed in scripts/fixtures/<command>.skip: examples a batch can't reproduce,
 *  because they need a concurrent writer, a live log rotation or a network peer. Each is
 *  accompanied there by a comment saying how it was verified instead.
 *
 *  Matched whole, never as a prefix, so an entry can't quietly exempt a longer title
 *  alongside the one it names. Every entry must name a real example that documents an
 *  `output:` block: one matching nothing reads as an exemption while exempting nothing,
 *  and is an error. */
export function loadSkipTitles(command: string, titlesWithOutput: string[]): Set<string> {
  const entries = readSkipEntries(command);
  const known = new Set(titlesWithOutput);
  const stale = entries.filter((t) => !known.has(t));
  if (stale.length) {
    throw new ReplayError(
      `scripts/fixtures/${command}.skip names ${stale.length} example(s) that don't exist on the page (or carry no output: block):\n` +
        stale.map((t) => `  ${JSON.stringify(t)}`).join("\n") +
        `\nRename or remove them — an entry that matches nothing exempts nothing, and reads as though it does.`,
    );
  }
  return new Set(entries);
}

/** Reads the `# verify:` lines from a setup script:
 *
 *      # verify: --user
 *      # verify: --systemd
 *
 *  `--user` runs the examples as the unprivileged `user`. Pages printing file ownership or
 *  a permission denial need it, since root is never denied and every `ls -l` would say
 *  `root root`.
 *
 *  `--systemd` requires a sandbox booted with systemd as PID 1, which `systemctl` and
 *  `journalctl` examples need and which costs --privileged and the host's cgroup tree.
 *
 *  Keeping both beside the fixtures means the documented invocation is correct for every
 *  page, and a score is reproducible without knowing a flag in advance. */
/** How a page has to be replayed, as declared by its own setup script. */
export interface SetupDirectives {
  /** Run the examples as the unprivileged `user` rather than root. */
  asUser: boolean;
  /** Requires a sandbox booted with systemd as PID 1. */
  needsSystemd: boolean;
}

const KNOWN_DIRECTIVES = ["--user", "--systemd"] as const;

export function readSetupDirectives(setupPath: string | undefined): SetupDirectives {
  const none: SetupDirectives = { asUser: false, needsSystemd: false };
  if (!setupPath) return none;
  let source = "";
  try {
    source = readFileSync(setupPath, "utf-8");
  } catch {
    return none;
  }
  const directives = [...source.matchAll(/^#\s*verify:\s*(.+)$/gm)].flatMap((m) =>
    (m[1] ?? "").trim().split(/\s+/),
  );
  const unknown = directives.filter((d) => !(KNOWN_DIRECTIVES as readonly string[]).includes(d));
  if (unknown.length) {
    throw new ReplayError(
      `${setupPath}: unknown "# verify:" directive(s): ${unknown.join(" ")} (understood: ${KNOWN_DIRECTIVES.join(", ")})`,
    );
  }
  return { asUser: directives.includes("--user"), needsSystemd: directives.includes("--systemd") };
}
