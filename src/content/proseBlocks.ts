// Finds the (command, output) pairs on a prose page: concepts, scripting, recipes, debian.
//
// Command pages carry their examples as structured YAML, so a tool can read the command and
// its claimed output straight off the file. Prose pages state the same kind of claim in
// Markdown, as a ```bash fence followed by the output it produced, and until this existed
// nothing checked any of them.
//
// The pairing rule is deliberately strict: an output fence counts as belonging to a command
// only when it opens on the line immediately after that command's fence closes. Pairing on
// document order instead attributes a block to a command the prose has separated it from, and
// the page then reports as verified while checking the wrong claim.
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
 * field on a command page's examples. Two field names for one idea, which is only safe while
 * they stay in step. */

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

/** An output fence with no command fence immediately above it: a claim about what something
 *  prints that no command on the page produces. */
export interface UnpairedBlock {
  /** What the page claims is printed. */
  output: string;
  /** 1-based line of the opening fence. */
  line: number;
  /** Text after the `skip` keyword on the directive above it: why nothing reproduces this. */
  note: string;
}

export interface ProsePage {
  pairs: ProsePair[];
  /** Bare output fences with no command fence immediately above them.
   *
   *  Returned as blocks rather than as a count, because two things need to read what is inside
   *  them: the architecture test, which must scan every published output for a machine name
   *  wherever it appears, and the exemption check, which requires each to say why nothing
   *  reproduces it. A count told neither of them anything. */
  unpaired: UnpairedBlock[];
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
 *  default and is never written as a directive, since there would be nothing for it to say. */
const DIRECTIVE = new RegExp(
  `^\\s*<!--\\s*verify:\\s*(${Object.values(COMPARISON)
    .filter((mode) => mode !== COMPARISON.exact)
    .join("|")})\\b\\s*(.*?)\\s*-->\\s*$`,
);

/** A fence line: the backticks, then an info string whose first word is the language.
 *
 *  Anything after that first word is accepted and ignored. Requiring the line to end after the
 *  language would leave a fence written ```` ```bash title="x" ```` unrecognised *as a fence*,
 *  read as content, inverting every open/close pairing after it on the page. That fails
 *  silently: the page still renders, and the replay reports the blocks as "not checkable",
 *  which is the one failure mode this harness exists to prevent. */
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

  /** The `verify:` directive on the line above a fence, if there is one. */
  const directiveAbove = (fence: Fence): RegExpExecArray | null =>
    DIRECTIVE.exec(lines[fence.start - 2] ?? "");

  for (const [index, fence] of found.entries()) {
    if (fence.lang !== "bash") continue;
    const next = found[index + 1];
    if (!next || next.lang !== "" || next.start !== fence.end + 1) continue;

    pairedOutputs.add(next.start);
    const directive = directiveAbove(fence);
    pairs.push({
      command: fence.body,
      output: next.body,
      line: fence.start,
      comparison: (directive?.[1] as Comparison | undefined) ?? COMPARISON.exact,
      note: directive?.[2] ?? "",
    });
  }

  const unpaired = found
    .filter((fence) => fence.lang === "" && !pairedOutputs.has(fence.start))
    .map((fence) => {
      // Read with the same directive parser a pair uses, so `skip` means one thing on this page
      // whichever kind of block carries it. Only the note is kept: an unpaired block is never run,
      // so there is no comparison to relax, and `shape` above one would be an instruction to
      // nothing.
      const directive = directiveAbove(fence);
      return {
        output: fence.body,
        line: fence.start,
        note: directive?.[1] === COMPARISON.skip ? (directive[2] ?? "") : "",
      };
    });
  return { pairs, unpaired };
}

export function parseProseFile(path: string): ProsePage {
  return parseProsePage(readFileSync(path, "utf-8"));
}
