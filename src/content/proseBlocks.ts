// Finds the (command, output) pairs on a prose page — concepts, scripting, recipes, debian.
//
// Command pages carry their examples as structured YAML, so a tool can read the command and
// its claimed output straight off the file. Prose pages state the same kind of claim in
// Markdown, as a ```bash fence followed by the output it produced, and until this existed
// nothing checked any of them.
//
// The pairing rule is deliberately strict: an output fence counts as belonging to a command
// only when it opens on the line immediately after that command's fence closes. Pairing on
// document order instead matches a block that prose has separated from its command, which on
// one page silently attributed a simulated install's output to a real one.
import { readFileSync } from "node:fs";
import { COMPARISON, type Comparison } from "./schema.js";

/* How a pair is compared is set by an HTML comment on the line above the command fence:
 *
 *    <!-- verify: shape the uptime and PID differ per machine -->
 *    <!-- verify: skip needs a second terminal writing to the file -->
 *
 * HTML is dropped by the Markdown pipeline, so neither reaches the reader. A skip must
 * carry a reason: an unexplained exemption reads as verified when it is the opposite.
 *
 * The vocabulary itself is `COMPARISON` in src/content/schema.ts, shared with the `compare:`
 * field on a command page's examples — two field names for one idea, and they are worth
 * exactly as much as they are worth together. */

export interface ProsePair {
  /** Shell to run, verbatim from the ```bash fence. */
  command: string;
  /** What the page claims it prints. */
  output: string;
  /** 1-based line of the command fence, for locating a mismatch in the file. */
  line: number;
  comparison: Comparison;
  /** Text after the directive keyword: why it is skipped, or what differs by machine. */
  note: string;
}

export interface ProsePage {
  pairs: ProsePair[];
  /** Bare output fences with no command fence immediately above them. Each is a claim
   *  about what something prints that nothing can check, so the count is reported. */
  unpaired: number;
}

interface Fence {
  lang: string;
  body: string;
  /** 1-based line of the opening ``` */
  start: number;
  /** 1-based line of the closing ``` */
  end: number;
}

/** Built from `COMPARISON` rather than written out, so a fourth comparison mode cannot be added
 *  to the vocabulary and silently left unparseable here. `exact` is excluded because it is the
 *  default and is never written as a directive — there would be nothing for it to say. */
const DIRECTIVE = new RegExp(
  `^\\s*<!--\\s*verify:\\s*(${Object.values(COMPARISON)
    .filter((mode) => mode !== COMPARISON.exact)
    .join("|")})\\b\\s*(.*?)\\s*-->\\s*$`,
);

/** A fence line: the backticks, then an info string whose first word is the language.
 *
 *  Anything after that first word is accepted and ignored. Requiring the line to end after the
 *  language (`/^```(\S*)\s*$/`) meant a fence written ```` ```bash title="x" ```` was not
 *  recognised as a fence *at all* — it was read as content, which inverted every open/close
 *  pairing after it on the page. The page still rendered, the replay reported the block as "not
 *  checkable", and nothing failed: verification was lost silently, which is the one failure mode
 *  this harness exists to prevent. */
const OPEN = /^```([^\s`]*)(?:\s+\S.*)?\s*$/;

/** A closing fence carries no info string, so only a bare ``` closes an open block. Keeping the
 *  two patterns separate is what lets an info string be accepted on the way in without a line
 *  like ```` ```bash ```` *inside* an output block closing the block that contains it. */
const CLOSE = /^```\s*$/;

function fences(source: string): Fence[] {
  const lines = source.split("\n");
  const found: Fence[] = [];
  let open: { lang: string; start: number; body: string[] } | null = null;

  for (const [index, line] of lines.entries()) {
    if (open) {
      if (CLOSE.test(line)) {
        found.push({ lang: open.lang, body: open.body.join("\n"), start: open.start, end: index + 1 });
        open = null;
      } else {
        open.body.push(line);
      }
      continue;
    }
    const fence = OPEN.exec(line);
    if (fence) open = { lang: fence[1] ?? "", start: index + 1, body: [] };
  }
  return found;
}

export function parseProsePage(source: string): ProsePage {
  const lines = source.split("\n");
  const found = fences(source);
  const pairs: ProsePair[] = [];
  const pairedOutputs = new Set<number>();

  for (const [index, fence] of found.entries()) {
    if (fence.lang !== "bash") continue;
    const next = found[index + 1];
    if (!next || next.lang !== "" || next.start !== fence.end + 1) continue;

    pairedOutputs.add(next.start);
    const above = lines[fence.start - 2] ?? "";
    const directive = DIRECTIVE.exec(above);
    pairs.push({
      command: fence.body,
      output: next.body,
      line: fence.start,
      comparison: (directive?.[1] as Comparison | undefined) ?? COMPARISON.exact,
      note: directive?.[2] ?? "",
    });
  }

  const unpaired = found.filter((fence) => fence.lang === "" && !pairedOutputs.has(fence.start)).length;
  return { pairs, unpaired };
}

export function parseProseFile(path: string): ProsePage {
  return parseProsePage(readFileSync(path, "utf-8"));
}
