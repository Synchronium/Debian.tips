// Locating and rewriting an example's `output:` block in examples.yaml, for the two tools
// that edit one: adopt-real-output.ts and fix-output-whitespace.ts.
//
// The file is edited as text rather than re-serialised from the parsed document: a YAML
// round-trip would reformat every block on the page, discard its comments, and turn a
// one-example change into an unreviewable diff.

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

/** Why a lookup failed. A missing output block is routine — plenty of examples document
 *  none — while a title matching zero or several lines means the file is not what the
 *  caller believes it to be. */
export type BlockLookup =
  | { found: true; block: OutputBlock }
  | { found: false; reason: "no-output-block" }
  | { found: false; reason: "title-matches"; count: number };

/** Finds the `output:` block belonging to the example with exactly this title. Titles are
 *  compared whole, so one that is a prefix of another cannot resolve to the wrong block. */
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

/** Replaces a block's contents with `body`, mutating and returning `lines`.
 *
 *  Always written with an explicit `|2` indicator, never a bare `|`: a bare block takes its
 *  strip width from its first line, so output whose first line is indented more than the
 *  rest (`wc` and `uniq -c` right-align their counts) loses that padding. */
export function replaceOutputBlock(lines: string[], block: OutputBlock, body: string): string[] {
  const indent = " ".repeat(block.keyIndent + 2);
  const rendered = body.split("\n").map((line) => (line === "" ? "" : indent + line));
  lines.splice(block.keyLine, block.end - block.keyLine, `${" ".repeat(block.keyIndent)}output: |2`, ...rendered);
  return lines;
}
