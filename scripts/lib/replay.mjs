// Shared by scripts/verify-examples.mjs and scripts/adopt-real-output.mjs.
//
// Anything both scripts need to agree on lives here rather than in each of them. They
// have drifted apart twice — once over normalisation, once over how a title is matched —
// and each time the symptom was a page that one tool wrote and the other rejected.
import { readFileSync } from "node:fs";

/** Examples a batch replay genuinely can't reproduce, listed by title in
 *  scripts/fixtures/<command>.skip with a comment saying how each was verified instead.
 *
 *  Matched exactly, never as a substring: a skip entry that is a prefix of a longer
 *  title ("Find symlinks" / "Find symlinks that point to a regular file") would quietly
 *  exempt the longer example too, and the page would keep reporting a clean N/N while
 *  covering less than it claims.
 *
 *  Every entry must name a real example carrying an `output:` block, because the file
 *  reads as a record of why specific examples are exempt. Two entries in tar.skip named
 *  examples that had been renamed months earlier and exempted nothing at all. */
export function loadSkipTitles(command, titlesWithOutput) {
  let entries = [];
  try {
    entries = readFileSync(`scripts/fixtures/${command}.skip`, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return new Set(); // no skip file: nothing is exempt
  }

  const known = new Set(titlesWithOutput);
  const stale = entries.filter((t) => !known.has(t));
  if (stale.length) {
    console.error(
      `scripts/fixtures/${command}.skip names ${stale.length} example(s) that don't exist on the page (or carry no output: block):\n` +
        stale.map((t) => `  ${JSON.stringify(t)}`).join("\n") +
        `\nRename or remove them — an entry that matches nothing exempts nothing, and reads as though it does.`,
    );
    process.exit(2);
  }
  return new Set(entries);
}

/** How a page has to be replayed, read from a `# verify:` line in its setup script:
 *
 *      # verify: --user
 *
 *  Four pages (chmod, find, tar, wget) document output containing file ownership, so
 *  they only reproduce when the examples run as the unprivileged `user`. Replaying chmod
 *  as root reports 9/42 on a page that is entirely correct, and the obvious reading of
 *  that is "the page drifted" — an afternoon's debugging for a flag nothing recorded.
 *  Keeping the mode next to the fixtures makes the documented command right for every
 *  page, and makes a transcript self-describing. */
export function readSetupDirectives(setupPath) {
  if (!setupPath) return { asUser: false };
  let source = "";
  try {
    source = readFileSync(setupPath, "utf-8");
  } catch {
    return { asUser: false };
  }
  const directives = [...source.matchAll(/^#\s*verify:\s*(.+)$/gm)].flatMap((m) => m[1].trim().split(/\s+/));
  const unknown = directives.filter((d) => d !== "--user");
  if (unknown.length) {
    console.error(`${setupPath}: unknown "# verify:" directive(s): ${unknown.join(" ")} (only --user is understood)`);
    process.exit(2);
  }
  return { asUser: directives.includes("--user") };
}

/** Single-quotes a string for `bash -c`. */
export function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
