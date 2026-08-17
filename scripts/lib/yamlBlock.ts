// Locating and rewriting an example's `output:` block in examples.yaml, shared by the two
// tools that edit one: adopt-real-output.ts and fix-output-whitespace.ts.
//
// adopt-real-output.ts had this fixed already: it parses each `- title:` line as YAML and
// refuses to write when a title resolves to anything other than one line.
// fix-output-whitespace.ts still looked its example up by the title's first 40 characters
// and took the first line matching anywhere in the file, which on a page with two titles
// sharing a prefix writes one example's output into the other's block. One implementation
// with the stricter behaviour, rather than two that disagree about it.
//
// These tools edit the file as text rather than re-serialising the parsed document,
// deliberately: a YAML round-trip would reformat every block on the page, discard the
// comments, and turn a one-example change into an unreviewable diff.

/** Where an example's `output:` block sits in the file. */
export interface OutputBlock {
  /** Index of the `output: |` line itself. */
  keyLine: number;
  /** Index one past the block's last line. */
  end: number;
  /** Columns of indentation on the `output:` key. */
  keyIndent: number;
}

/** The title on a `- title: "..."` line, or null if the line isn't one. */
function titleOnLine(line: string): string | null {
  const match = /^\s*-\s+title:\s*(.+?)\s*$/.exec(line);
  if (!match) return null;
  const raw = match[1] ?? "";
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

/** Why a lookup failed, so each caller can decide what to do about it: a missing output
 *  block is routine (plenty of examples document none), while a title matching zero or
 *  several lines means the file isn't what the caller thinks it is. */
export type BlockLookup =
  | { found: true; block: OutputBlock }
  | { found: false; reason: "no-output-block" }
  | { found: false; reason: "title-matches"; count: number };

/** Finds the `output:` block belonging to the example with exactly this title. */
export function findOutputBlock(lines: string[], title: string): BlockLookup {
  const titleLines = lines.flatMap((line, i) => (titleOnLine(line) === title ? [i] : []));
  if (titleLines.length !== 1) return { found: false, reason: "title-matches", count: titleLines.length };
  const titleLine = titleLines[0] as number;

  let keyLine = -1;
  for (let i = titleLine + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (titleOnLine(line) !== null) break; // reached the next example
    if (/^\s+output:\s*\|/.test(line)) {
      keyLine = i;
      break;
    }
  }
  if (keyLine === -1) return { found: false, reason: "no-output-block" };

  const keyIndent = (/^(\s*)/.exec(lines[keyLine] as string)?.[1] ?? "").length;
  // The block runs to the first line that is neither blank nor indented past the key.
  let end = keyLine + 1;
  while (end < lines.length) {
    const line = lines[end] as string;
    if (line.trim() !== "" && line.search(/\S/) <= keyIndent) break;
    end++;
  }
  return { found: true, block: { keyLine, end, keyIndent } };
}

/** Replaces a block's contents with `body`, written as `output: |2`.
 *
 *  Always the explicit `|2` indicator, never a bare `|`: a bare block takes its strip
 *  width from its first line, so output whose first line is indented more than the rest
 *  (`wc` and `uniq -c` right-align their counts) comes back with that padding silently
 *  removed. Mutates and returns `lines`. */
export function replaceOutputBlock(lines: string[], block: OutputBlock, body: string): string[] {
  const indent = " ".repeat(block.keyIndent + 2);
  const rendered = body.split("\n").map((line) => (line === "" ? "" : indent + line));
  lines.splice(block.keyLine, block.end - block.keyLine, `${" ".repeat(block.keyIndent)}output: |2`, ...rendered);
  return lines;
}
