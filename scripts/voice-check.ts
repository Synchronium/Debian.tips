// Checks prose against the lexical half of .claude/reference/voice.md.
//
//   npx tsx scripts/voice-check.ts                  # the whole corpus
//   npx tsx scripts/voice-check.ts <file>…         # named files
//   npx tsx scripts/voice-check.ts --hook           # one file, from a PostToolUse hook on stdin
//
// It finds the tells that are spellings. It cannot find the ones that are shapes: an aphoristic
// closer, a manufactured misconception, a section that comments on itself. Those need the page
// read, and a green run here says nothing about them.
//
// Three severities, because the guide has three kinds of rule. `fail` is what §5 bans outright,
// and the corpus is at zero, so anything found is new. `report` is a phrase that is fine a few
// times and wrong as a habit, which only a whole-corpus count can judge. `advisory` is a prompt
// to look at a line, never a verdict, because the guide says a few of each are correct.
//
// Exit status: 0 when nothing failed, and 1 on a `fail` finding. Under --hook that becomes 2,
// which is the status Claude Code feeds back to whoever wrote the line rather than to the human
// watching the session.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { CONTENT_DIR, EXAMPLES_FILE, ROOT } from "../src/paths.js";

export const SEVERITY = {
  /** Banned outright by voice.md §5. The corpus is at zero and stays there. */
  fail: "fail",
  /** Fine occasionally, a tic in bulk. Counted across the corpus, not per file. */
  report: "report",
  /** Worth a look at the line. Never a verdict. */
  advisory: "advisory",
} as const;
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

interface Rule {
  readonly id: string;
  readonly severity: Severity;
  readonly pattern: RegExp;
  readonly message: string;
  /** `report` rules only: how many uses across the corpus stop being a few and become a habit. */
  readonly budget?: number;
}

// Word boundaries matter more here than anywhere else in these patterns. Written as bare
// substrings, `is real` matches "is really" and `turns on` matches "turns one", which is 9 of the
// 9 hits those two produce across the corpus and none of the thing being looked for.
const RULES: readonly Rule[] = [
  {
    id: "significance-claim",
    severity: SEVERITY.fail,
    pattern: /\b(?:this|that|it) is the \w+(?: \w+)? that matters\b/gi,
    message:
      'voice.md §5: asserts significance instead of showing it. State the fact, or use "the important difference is".',
  },
  {
    id: "significance-family",
    severity: SEVERITY.fail,
    pattern:
      /\b(?:what really matters|the (?:key|main) thing to understand|the real question is|what this really means|at the heart of this|the only part that counts|the thing that actually matters)\b/gi,
    message: 'voice.md §5: same family as "the X that matters".',
  },
  {
    id: "showy-praise",
    severity: SEVERITY.fail,
    pattern: /\b(?:load-bearing|earns its keep|earn its keep|earns its place|earn its place)\b/gi,
    message: "voice.md §5: showy where plain description would do.",
  },
  {
    id: "reader-instruction",
    severity: SEVERITY.fail,
    pattern:
      /\b(?:this is where people go wrong|what most guides miss|here's why that matters|here is why that matters)\b/gi,
    message: "voice.md §4: writing about the document rather than the subject.",
  },
  {
    id: "em-dash",
    severity: SEVERITY.fail,
    pattern: /—/g,
    message: "voice.md §4: em dash. A hyphen is what a keyboard has.",
  },
  {
    id: "claims-reality",
    severity: SEVERITY.advisory,
    pattern: /\b(?:is|are) real\b/gi,
    message:
      "voice.md §5: claims importance for a fact that could simply be stated. Ordinary uses exist, so check.",
  },
  {
    id: "turns-on",
    severity: SEVERITY.advisory,
    pattern: /\bturns on\b/gi,
    message: 'voice.md §5: banned in the sense of "it turns on one word". A literal switch is fine.',
  },
  {
    id: "reach-for",
    severity: SEVERITY.report,
    pattern: /\breach(?:es|ing)? for\b/gi,
    budget: 6,
    message: "voice.md §5: fine a few times, a verbal tic in bulk.",
  },
  {
    id: "adverb-of-obviousness",
    severity: SEVERITY.report,
    pattern: /\b(?:plainly|clearly|obviously|of course)\b/gi,
    budget: 12,
    message:
      "voice.md §5: tells the reader how apparent something is. A few across the site sound like a person.",
  },
];

// `, and` joining a consequence is in the guide and is deliberately not a rule here. Whether the
// second clause follows from the first is a question about meaning, and the nearest pattern
// matches 185 lines across the corpus of which almost none are the fault. A check that is wrong
// that often teaches its reader to skip it, which costs more than the rule was worth.

/** Everything the guide exempts, plus the guide itself: voice.md quotes every phrase it bans, so
 *  checking it would report the rules as violations of themselves. */
const EXEMPT = new Set([".claude/reference/voice.md"]);

/** The synthetic content tree the build tests run over, which publishes nothing.
 *
 *  Exempt because its bytes are what the tests assert against. A fixture is a stand-in, not
 *  prose, and holding one to the guide invites someone to improve a sentence that a build test
 *  compares character for character. The rest of `test/` is checked: those comments explain what
 *  a test is defending and are read like any other. */
const EXEMPT_DIRS: readonly string[] = [join(ROOT, "test", "fixtures")];

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly rule: Rule;
  readonly text: string;
}

/** Comment lines in a TypeScript or shell source file, with the code between them dropped.
 *
 *  voice.md applies to code comments, which ADR-0017 puts one click away from every page they
 *  helped produce. It does not apply to code: a string literal, an identifier or a regular
 *  expression is not a sentence, and `voice-check.ts` itself quotes every phrase it bans, so
 *  offering the code to the rules would have the checker fail on its own rule table.
 *
 *  Only whole-line comments. A trailing `// like this` sits on a line whose code half would come
 *  with it, and the cases worth catching are the block comments above a declaration, which is
 *  where this repository does its explaining. */
function commentLines(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inBlock = false;
  source.split("\n").forEach((text, index) => {
    const trimmed = text.trimStart();
    const isLineComment = trimmed.startsWith("//") || trimmed.startsWith("#");
    if (inBlock || isLineComment || trimmed.startsWith("/*")) {
      out.push({ line: index + 1, text });
    }
    if (trimmed.startsWith("/*") && !trimmed.includes("*/")) inBlock = true;
    if (inBlock && trimmed.includes("*/")) inBlock = false;
  });
  return out;
}

/** Prose lines only, with captured text removed.
 *
 *  A page's `output:` block is what a command printed, and a fixture's `content:` is what a file
 *  holds. Editing either for style would be falsifying it, so neither is offered to the rules.
 *  `code:` goes too: it is a command, and a flag is not a sentence. */
export function proseLines(path: string, source: string): { line: number; text: string }[] {
  const isExamples = path.endsWith(EXAMPLES_FILE);
  const out: { line: number; text: string }[] = [];
  let inFence = false;
  let blockIndent: number | null = null;

  if (isCode(path)) return commentLines(source);

  if (!isExamples) {
    source.split("\n").forEach((text, index) => {
      const line = index + 1;
      if (/^\s*```/.test(text)) {
        inFence = !inFence;
        return;
      }
      if (!inFence) out.push({ line, text });
    });
    return out;
  }

  source.split("\n").forEach((text, index) => {
    const line = index + 1;

    // Inside a block scalar, every line more indented than the key that opened it is content.
    if (blockIndent !== null) {
      const indent = text.search(/\S/);
      if (text.trim() === "" || indent > blockIndent) return;
      blockIndent = null;
    }
    const opener = /^(\s*)(?:- )?(output|content):\s*[|>]/.exec(text);
    if (opener?.[1] !== undefined) {
      blockIndent = opener[1].length;
      return;
    }
    if (/^\s*(?:- )?(?:code|from):/.test(text)) return;
    out.push({ line, text });
  });

  return out;
}

export function checkFile(absolute: string): Finding[] {
  const file = relative(ROOT, absolute);
  if (EXEMPT.has(file)) return [];
  if (EXEMPT_DIRS.some((dir) => resolve(absolute).startsWith(dir + sep))) return [];
  const findings: Finding[] = [];
  for (const { line, text } of proseLines(file, readFileSync(absolute, "utf-8"))) {
    for (const rule of RULES) {
      for (const match of text.matchAll(rule.pattern)) {
        findings.push({ file, line, rule, text: match[0] });
      }
    }
  }
  return findings;
}

function walk(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path, keep);
    return keep(path) ? [path] : [];
  });
}

/** Where the guide applies, and the only definition of it. Both entry points read these: the
 *  corpus walk collects them, and the hook admits a written file only if it is one of them.
 *
 *  The hook needs the test as much as the walk does. It is handed whatever path was just written,
 *  which is any file in the repository, and prose the guide was never written for is out of scope
 *  rather than failing. Without the test, editing a personal note produces a wall of findings
 *  against sentences nobody agreed to hold to this. */
const VOICE_DIRS: readonly string[] = [
  CONTENT_DIR,
  join(ROOT, "docs"),
  join(ROOT, ".claude"),
  // The code, for its comments. voice.md's opening says it applies to "every sentence this
  // repository publishes", and names code comments explicitly, because ADR-0017 puts every one of
  // them one click away from a page they helped produce. Leaving these out meant the guide's claim
  // that the corpus sits at zero was true only of the half the checker happened to walk, and it
  // was not true of the other half.
  join(ROOT, "src"),
  join(ROOT, "scripts"),
  join(ROOT, "test"),
];
const VOICE_FILES: readonly string[] = [join(ROOT, "README.md"), join(ROOT, "CLAUDE.md")];

/** Source files, checked for their comments and not for their code. */
const CODE_EXTENSIONS = [".ts", ".sh"];
const isCode = (path: string): boolean => CODE_EXTENSIONS.some((ext) => path.endsWith(ext));

const isProse = (path: string): boolean =>
  path.endsWith(".md") || path.endsWith(EXAMPLES_FILE) || isCode(path);

export function inScope(path: string): boolean {
  const absolute = resolve(path);
  if (!isProse(absolute)) return false;
  if (VOICE_FILES.includes(absolute)) return true;
  return VOICE_DIRS.some((dir) => {
    const within = relative(dir, absolute);
    return within !== "" && !within.startsWith("..") && !isAbsolute(within);
  });
}

function corpusFiles(): string[] {
  return [...VOICE_DIRS.flatMap((dir) => walk(dir, isProse)), ...VOICE_FILES];
}

/** The path a PostToolUse hook is reporting on, or null when the payload names none. */
function hookTarget(): string | null {
  let payload: { tool_input?: { file_path?: string } };
  try {
    payload = JSON.parse(readFileSync(0, "utf-8")) as typeof payload;
  } catch {
    return null;
  }
  return payload.tool_input?.file_path ?? null;
}

function describe(findings: Finding[], corpusMode: boolean): { text: string; failed: boolean } {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.rule.id, (counts.get(finding.rule.id) ?? 0) + 1);
  }

  const lines: string[] = [];
  let failed = false;

  for (const finding of findings) {
    const { rule } = finding;
    // A budget is a statement about the whole corpus, so a single file cannot be over it.
    if (rule.severity === SEVERITY.report) continue;
    if (rule.severity === SEVERITY.fail) failed = true;
    lines.push(`${rule.severity}  ${finding.file}:${finding.line}  "${finding.text}"  ${rule.message}`);
  }

  if (corpusMode) {
    for (const rule of RULES) {
      if (rule.severity !== SEVERITY.report || rule.budget === undefined) continue;
      const used = counts.get(rule.id) ?? 0;
      if (used > rule.budget) {
        lines.push(
          `report  ${used} uses of ${rule.id} across the corpus (budget ${rule.budget}). ${rule.message}`,
        );
      }
    }
  }

  return { text: lines.join("\n"), failed };
}

function main(): void {
  const args = process.argv.slice(2);
  const hookMode = args.includes("--hook");
  const named = args.filter((arg) => !arg.startsWith("-"));

  let targets: string[];
  if (hookMode) {
    const target = hookTarget();
    targets = target !== null && inScope(target) ? [target] : [];
  } else {
    targets = named.length ? named.map((path) => join(ROOT, relative(ROOT, path))) : corpusFiles();
  }

  if (targets.length === 0) process.exit(0);

  const findings = targets.flatMap(checkFile);
  const { text, failed } = describe(findings, !hookMode && named.length === 0);

  if (text) {
    // A hook reports on stderr, because that is the stream Claude Code feeds back to the author,
    // and only together with exit 2: any other non-zero status is shown to the human running the
    // session instead, which is the one person who did not write the line.
    const stream = hookMode ? process.stderr : process.stdout;
    stream.write(`${text}\n`);
  } else if (!hookMode) {
    process.stdout.write(`voice-check: ${targets.length} file(s), nothing to report.\n`);
  }

  const HOOK_FEEDBACK_STATUS = 2;
  if (!failed) process.exit(0);
  process.exit(hookMode ? HOOK_FEEDBACK_STATUS : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
