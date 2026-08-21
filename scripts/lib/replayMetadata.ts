// What the replay reads about a page before it runs anything: the error it raises, the examples
// the page exempts, and the directives its setup script declares.
import { readFileSync } from "node:fs";
import { readSkipEntries } from "../../src/content/replaySkips.js";

/** A page cannot be replayed as asked: a stale exemption, an unknown directive, a sandbox that
 *  is not what the page needs. Thrown rather than exiting, so the batch runner can report the
 *  page and carry on with the rest — and so these tools can be called as functions at all. */
export class ReplayError extends Error {}

/** Titles listed in `scripts/fixtures/<command>.skip`: examples a batch cannot reproduce, each
 *  accompanied there by a comment saying how it was verified instead.
 *
 *  Matched whole, never as a prefix, so an entry cannot quietly exempt a longer title alongside
 *  the one it names. Every entry must name a real example that documents an `output:` block: one
 *  matching nothing reads as an exemption while exempting nothing, and is an error. */
export function loadSkipTitles(command: string, titlesWithOutput: string[]): Set<string> {
  const entries = readSkipEntries(command);
  const known = new Set(titlesWithOutput);
  const stale = entries.filter((title) => !known.has(title));
  if (stale.length) {
    throw new ReplayError(
      `scripts/fixtures/${command}.skip names ${stale.length} example(s) that don't exist on the page (or carry no output: block):\n` +
        stale.map((title) => `  ${JSON.stringify(title)}`).join("\n") +
        `\nRename or remove them — an entry that matches nothing exempts nothing, and reads as though it does.`,
    );
  }
  return new Set(entries);
}

/** The `# verify:` directives a setup script may declare. The values are the flags themselves,
 *  so the set a script is checked against and the flags read out of it are one definition — two
 *  copies fail open, leaving a renamed directive unrecognised while the error message still
 *  lists it. */
export const SETUP_DIRECTIVE = {
  /** Run the examples as the unprivileged `user` rather than root. Pages printing file ownership
   *  or a permission denial need it: root is never denied, and every `ls -l` would say
   *  `root root`. */
  user: "--user",
  /** Requires a sandbox booted with systemd as PID 1, which `systemctl` and `journalctl`
   *  examples need and which costs `--privileged` and the host's cgroup tree. */
  systemd: "--systemd",
} as const;

const KNOWN_DIRECTIVES: readonly string[] = Object.values(SETUP_DIRECTIVE);

/** How a page has to be replayed, as declared by its own setup script.
 *
 *  Declared beside the fixtures rather than passed on the command line so the documented
 *  invocation is correct for every page, and a score is reproducible without knowing a flag in
 *  advance. */
export interface SetupDirectives {
  asUser: boolean;
  needsSystemd: boolean;
}

export function readSetupDirectives(setupPath: string | undefined): SetupDirectives {
  const none: SetupDirectives = { asUser: false, needsSystemd: false };
  if (!setupPath) return none;
  let source = "";
  try {
    source = readFileSync(setupPath, "utf-8");
  } catch {
    return none;
  }
  const declared = [...source.matchAll(/^#\s*verify:\s*(.+)$/gm)].flatMap((match) =>
    (match[1] ?? "").trim().split(/\s+/),
  );
  const unknown = declared.filter((directive) => !KNOWN_DIRECTIVES.includes(directive));
  if (unknown.length) {
    throw new ReplayError(
      `${setupPath}: unknown "# verify:" directive(s): ${unknown.join(" ")} (understood: ${KNOWN_DIRECTIVES.join(", ")})`,
    );
  }
  return {
    asUser: declared.includes(SETUP_DIRECTIVE.user),
    needsSystemd: declared.includes(SETUP_DIRECTIVE.systemd),
  };
}
