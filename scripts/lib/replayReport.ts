// How a replay reports itself: the score line, and the first line that differs.
//
// The command-page and prose-page replays are the same program with two front ends: one reads
// YAML, the other reads Markdown fences. Shared so the two cannot drift into describing the same
// result differently.

/** The first line that differs, quoted so leading and trailing spaces are visible.
 *  A mismatch is usually one line deep in an otherwise-correct block. */
export function firstDifference(want: string, got: string): string {
  const wantLines = want.split("\n");
  const gotLines = got.split("\n");
  const total = Math.max(wantLines.length, gotLines.length);
  for (let i = 0; i < total; i++) {
    if (wantLines[i] === gotLines[i]) continue;
    const show = (line: string | undefined): string =>
      line === undefined ? "(no such line)" : JSON.stringify(line);
    return [
      `    line ${i + 1} of ${total} differs:`,
      `      page: ${show(wantLines[i])}`,
      `      real: ${show(gotLines[i])}`,
    ].join("\n");
  }
  return "    (identical line by line, a trailing-newline difference)";
}

export interface Score {
  /** The page being replayed. */
  page: string;
  /** Whether the examples ran as the unprivileged `user`. */
  asUser: boolean;
  matched: number;
  total: number;
  /** How many of the matches were compared by shape rather than exactly. */
  shapeMatches: number;
  /** How many were held to their lines but not to the order of them, and were not also compared
   *  by shape. Counted apart from `shapeMatches` so the clauses sum to `matched`. */
  unorderedMatches: number;
  /** Trailing clauses particular to one kind of page: fixture blocks, skipped examples. */
  notes: string[];
}

/** The one line that says what a page scored.
 *
 *  The mode is part of the result: the same page scores 42/42 as `user` and 9/42 as root, so a
 *  score quoted without it means nothing. "Reproduces exactly" is a stronger claim than "has the
 *  same shape" or "has the same lines", so they are counted in one total and never described as
 *  the same thing. Leaving either relaxation out of this line would report a page as stricter
 *  than it is, to the reader most likely to quote the number. */
export function scoreLine(score: Score): string {
  const relaxed = [
    score.shapeMatches ? `${score.shapeMatches} by shape` : "",
    score.unorderedMatches ? `${score.unorderedMatches} in any order` : "",
  ].filter((clause) => clause !== "");
  const how =
    relaxed.length === 0
      ? " exactly"
      : ` (${[`${score.matched - score.shapeMatches - score.unorderedMatches} exactly`, ...relaxed].join(", ")})`;
  const notes = score.notes.filter((note) => note !== "").join("");
  return `\n${score.page} (as ${score.asUser ? "user" : "root"}): ${score.matched}/${score.total} documented outputs reproduce${how}${notes}\n`;
}
