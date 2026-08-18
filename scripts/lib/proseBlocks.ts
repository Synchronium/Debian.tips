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

/** How a pair is compared, set by an HTML comment on the line above the command fence:
 *
 *    <!-- verify: shape the uptime and PID differ per machine -->
 *    <!-- verify: skip needs a second terminal writing to the file -->
 *
 *  HTML is dropped by the Markdown pipeline, so neither reaches the reader. A skip must
 *  carry a reason: an unexplained exemption reads as verified when it is the opposite. */
export type Comparison = "exact" | "shape" | "skip";

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

const DIRECTIVE = /^\s*<!--\s*verify:\s*(shape|skip)\b\s*(.*?)\s*-->\s*$/;

function fences(source: string): Fence[] {
  const lines = source.split("\n");
  const found: Fence[] = [];
  let open: { lang: string; start: number; body: string[] } | null = null;

  for (const [index, line] of lines.entries()) {
    const fence = /^```(\S*)\s*$/.exec(line);
    if (!fence) {
      if (open) open.body.push(line);
      continue;
    }
    if (open) {
      found.push({ lang: open.lang, body: open.body.join("\n"), start: open.start, end: index + 1 });
      open = null;
    } else {
      open = { lang: fence[1] ?? "", start: index + 1, body: [] };
    }
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
      comparison: (directive?.[1] as Comparison | undefined) ?? "exact",
      note: directive?.[2] ?? "",
    });
  }

  const unpaired = found.filter((fence) => fence.lang === "" && !pairedOutputs.has(fence.start)).length;
  return { pairs, unpaired };
}

export function parseProseFile(path: string): ProsePage {
  return parseProsePage(readFileSync(path, "utf-8"));
}
