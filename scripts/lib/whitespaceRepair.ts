// Deciding whether a documented `output:` block and a real capture differ only in the leading
// whitespace a bare YAML `|` strips, for scripts/authoring/fix-output-whitespace.ts.
//
// That tool rewrites examples.yaml in place, so this decision is the whole of what separates a
// formatting repair from making a wrong example pass. It is deliberately narrower than the
// replay's `normalise`: masks and stripped artifacts exist to let two runs of the same command
// agree, whereas a difference here that indentation cannot explain means the page and the
// command disagree about something, and nothing in this tool can know which of them is right.
// So anything it cannot account for is reported and left alone.

/** What a documented block and a fresh capture turned out to be to each other. */
export const REPAIR = {
  /** Already in agreement, once trailing spaces and blank edges are set aside. Nothing to do. */
  unchanged: "unchanged",
  /** Differing in leading whitespace alone: the padding this tool exists to restore. */
  indentation: "indentation",
  /** Differing in something else, so the block is left for a human to judge. */
  substance: "substance",
} as const;
export type Repair = (typeof REPAIR)[keyof typeof REPAIR];

/** Trailing whitespace per line, and blank lines at either end.
 *
 *  These are the differences no reader can see and no terminal preserves reliably, so a block
 *  differing only by them is already correct and must not be rewritten: a rewrite would give the
 *  file a new mtime and a diff that says nothing. */
export function trimEdges(text: string): string {
  return text.replace(/[ \t\r]+$/gm, "").replace(/^\n+|\n+$/g, "");
}

/** Comparable ignoring the leading whitespace this tool exists to restore.
 *
 *  Only the *leading* whitespace goes. Collapsing runs of spaces inside a line as well would
 *  make `40 report.txt` and `40  report.txt` compare equal, and a column that genuinely changed
 *  width would be silently overwritten as though it were padding. */
export function withoutIndentation(text: string): string {
  return trimEdges(text)
    .split("\n")
    .map((line) => line.trimStart())
    .join("\n");
}

/** Whether `captured` may be written over `documented`, and why.
 *
 *  `REPAIR.indentation` is the only verdict that permits a rewrite. It is reached only when the
 *  two agree line for line with leading whitespace removed, which means every line is present,
 *  in order, with the same content: the padding is all that moved. */
export function classifyRepair(captured: string, documented: string): Repair {
  const got = trimEdges(captured);
  const want = trimEdges(documented);
  if (got === want) return REPAIR.unchanged;
  return withoutIndentation(got) === withoutIndentation(want) ? REPAIR.indentation : REPAIR.substance;
}
