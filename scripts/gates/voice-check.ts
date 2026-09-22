// Checks prose against the lexical half of .claude/reference/voice.md.
//
//   npx tsx scripts/gates/voice-check.ts                  # the whole corpus
//   npx tsx scripts/gates/voice-check.ts <file>…         # named files
//   npx tsx scripts/gates/voice-check.ts --hook           # one file, from a PostToolUse hook on stdin
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
// Exit status: 0 when no rule failed, and 1 on a `fail` finding. Under --hook that becomes 2,
// which is the status Claude Code feeds back to whoever wrote the line rather than to the human
// watching the session.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { CONTENT_DIR, EXAMPLES_FILE, ROOT } from "../../src/paths.js";

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
  /** Matched line by line rather than against the joined paragraph, for a pattern that anchors
   *  on `^` and means the start of a caption. Everything else reads the paragraph, so that a
   *  construction split by a hard wrap is still seen. */
  readonly anchored?: boolean;
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
    // The word itself is fine, and the corpus is full of it: a reason that follows immediately
    // ("Order matters: the first matching value wins") is demonstration rather than assertion.
    // What this catches is the noun phrase, which names the importance and leaves the reason to
    // be supplied somewhere else, and the amplified form, which tells the reader they have
    // underestimated something instead of showing them why.
    id: "significance-nominalised",
    severity: SEVERITY.fail,
    pattern:
      /\bwhy\s+(?!(?:that|this|it)\s+matters\b)(?:the|a|an|its|your|our|his|her|their)?\s*[\w-]+(?:\s+[\w-]+){0,6}\s+matters\b|\bmatters more than you (?:think|realise|realize|expect|would think)\b/gi,
    message:
      "voice.md §5: names the importance instead of showing it. Give the reason on the spot, or cut the claim.",
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
    // `reached for` included: the past participle is the form that slips through a page written
    // in one sitting, and it reads as the same tic to anyone meeting three of them.
    pattern: /\breach(?:es|ing|ed)? for\b/gi,
    budget: 6,
    message: "voice.md §5: fine a few times, a verbal tic in bulk.",
  },
  {
    id: "numeral-led-opener",
    severity: SEVERITY.report,
    anchored: true,
    // Anchored to the start of a caption, which is the only place the shape is a tell: a count
    // in the middle of a sentence is usually the fact the sentence is about. A prose page's
    // paragraph openers are out of reach here, since a wrapped line beginning with a numeral
    // looks identical to one that opens a paragraph.
    //
    // `note:` is deliberately not matched. A fixture note is a label for sample data and the
    // schema gives "40 numbered lines" as its shape, so opening on a count is what it is for.
    pattern:
      /^\s*-?\s*(?:description|intro):\s*["']?(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|None|Both|Neither)\b/gim,
    budget: 6,
    message: "voice.md §4: a caption that opens by counting what follows. Fine a few times.",
  },
  {
    id: "positional-half",
    severity: SEVERITY.report,
    // Only the forms where a position stands in for a name. `public half`, `group half` and
    // `two halves` name the part they mean, and a pty and a `.deb` really do come in two, so
    // matching bare `half` would flag the sentences that are working.
    //
    // The compound adjectives (`half-finished`, `half-written`) and the quantity sense ("half
    // your list") are ordinary English and share nothing with this but the word. `dpkg` prints
    // `halF-conf/Half-inst` in captured output, which no rule may ask anyone to edit.
    pattern: /\bthe other half\b|\bthe (?:first|second) half\b|\b(?:this|that) half\b/gi,
    budget: 2,
    message:
      "voice.md §4: names something as two parts, then points at a part instead of naming it. Say which one you mean.",
  },
  {
    id: "absence-as-actor",
    severity: SEVERITY.report,
    // `nothing` as the subject of an active verb, where naming the actor or negating the verb is
    // shorter and says the same thing. voice.md §4 carries the worked examples: quoting a pair of
    // them here would put the construction into a file this very rule reads, which is the reason
    // voice.md is the one document exempt from the checker.
    //
    // The exclusions, each of which is ordinary English that shares only the word.
    //
    // The copula, because `nothing is printed` is a passive with no actor to name and reads
    // perfectly: it is 71 of the corpus's hits and none of them is the fault. `else` sits inside
    // the optional group rather than outside it, so `nothing else is printed` is excluded too.
    //
    // The perfect passive (`has been`, `have been`, `had been`) for the same reason: a different
    // auxiliary in front of the same participle, still with no actor the sentence could name. Only
    // the passive form goes. A bare `has` stays matched, since an absence that possesses something
    // is the construction rather than a passive.
    //
    // `with nothing added`, `with nothing captured`: an absolute construction rather than a
    // clause, so there is no verb to negate.
    //
    // `matches` and `happens`, which describe a search or an event coming back empty and have no
    // shorter form. `nothing matched` is what a page says about `grep`.
    //
    // `unless` and `this`, which end in an s and are not verbs. There is no general form of this
    // one, so the two the corpus contains are named and the rest would arrive as findings.
    //
    // The object shape the guide also names, `frees nothing` and `prints nothing`, has no rule
    // here. It was measured at roughly a third precision, because `means nothing`, `nothing but`
    // and `does nothing at all` are all ordinary, and a check wrong twice in three findings
    // teaches its reader to skip it.
    //
    // A verb in front turns the word into an object while the shape here stays the same, so a
    // sentence about a glob matching no files would read to this rule as an absence doing the
    // expanding. The `ing` lookbehind covers the part of that a spelling can decide: a gerund
    // immediately in front takes the word as its object, which leaves it no room to be a subject.
    //
    // **A finite verb in front is not the same case**, which is why the lookbehind asks for the
    // gerund and not for any word ending in `s`. A verb of meaning or showing takes a clause, and
    // the absence is then the subject of that clause and the fault being looked for.
    // `test/voiceCheck.test.ts` holds such a line, and the wider lookbehind silences it.
    //
    // What the pattern therefore cannot see, and what the budget holds room for: that case, and a
    // participle used as an adjective rather than a verb, which is what an ADR means by recording
    // that no automated thing enforces it. Both need to know which word is the subject, which is
    // grammar rather than spelling. Examples are in the commit that swept the corpus, deliberately
    // not here: a comment is prose this rule reads.
    pattern:
      /(?<!with )(?<![a-z]+ing )\bnothing (?:(?:can|could|will|would|may|might|must|should|does|did|do|ever|then|else|now|still|really|actually) )?(?!is\b|was\b|are\b|were\b|be\b|been\b|being\b|ha(?:s|ve|d) been\b|match|happen|unless\b|this\b)[a-z]+(?:s|ed)\b/gi,
    // Set from a swept corpus rather than chosen: ten findings survive the sweep, and every one is
    // a participle or a finite verb the rule cannot tell from the real construction. The margin is
    // for the next page, not for them.
    budget: 15,
    message: "voice.md §4: an absence as the subject of a verb. Name the actor, or negate the verb.",
  },
  {
    id: "and-nothing",
    severity: SEVERITY.report,
    // The conjunction form of the tell above, and the one that collects: a sentence finishes its
    // work, then has a clause bolted on saying that the failure goes unreported. Separate from
    // `absence-as-actor` rather than a case of it, because that rule's pattern wants a verb
    // ending in `s` or `ed`, while this shape usually puts a modal and a bare infinitive after
    // the word, which slips past it. A lower budget too: as an appended clause this is a habit of
    // paragraph-building rather than of sentence-building, so a corpus collects many more of them
    // before anyone notices one. No example is quoted here, for the reason the rule above gives.
    //
    // The exclusions are the honest uses, each of which shares only the word.
    //
    // `else`, `more` and `but` are the quantity sense. A pronoun or relative after it (`nothing
    // you send`, `nothing that walks a filesystem`) makes the word the head of a noun phrase
    // rather than an actor. The copula is a passive with no actor to name, which voice.md §4
    // already protects, and `happens` and `matches` describe an event or a search coming back
    // empty and have no shorter form.
    //
    // `nobody` and `no one` are the same shape with a person in the gap, so they are alternatives
    // here rather than a rule of their own. They carry more honest uses than `nothing` does,
    // because a person really can be the missing actor, and the corpus quotes a reader saying one
    // of them in the taxonomy tables. Both are what the budget is for.
    //
    // The exclusions are matched against the whole paragraph, so one wrapped away from the word it
    // excludes still fires. That is `wrappedParagraphs` below, and it is the reason this rule can
    // afford to state its exclusions as a plain word list.
    pattern:
      /\band (?:nothing|nobody|no[ -]one)\b(?! (?:else|more|but|you|that|which|they|we|is|was|are|were|be|been|being|to|about|for|happens|matches)\b)/gi,
    // Set from a swept corpus rather than chosen, as the rule above was. Four findings survive the
    // sweep: a reader quoted saying one of these in the taxonomy table, which appears both in an
    // ADR and in the comment the ADR was written from; this file's own description of the wrapped
    // phrase the paragraph matching fixed; and one setup script pairing the two clauses on
    // purpose. The margin is for the next page.
    budget: 6,
    message: "voice.md §4: an absence bolted onto the end of a sentence. Name the actor, or negate the verb.",
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
// matches hundreds of lines across the corpus of which almost none are the fault. A check that is
// wrong that often teaches its reader to skip it, which costs more than the rule was worth.

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

/** Every heredoc a shell line opens, in the order the shell will read them.
 *
 *  `<<EOF`, `<<-EOF` and either quoting of the delimiter all count. One line may open more than
 *  one (`cmd <<A <<B`), and the bodies then arrive in that order, which is why this returns a list
 *  rather than the first match.
 *
 *  `<<<` is a here-string, one line of code rather than a block, and it takes a guard on each side
 *  of the `<<`: the lookahead rejects it read from the first angle bracket, and the lookbehind from
 *  the second, where `<< "$var"` would otherwise parse as a heredoc named `$var` and swallow the
 *  rest of the file. */
function heredocDelimiters(line: string): string[] {
  const opener = /(?<!<)<<-?[ \t]*(?!<)(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/g;
  return [...line.matchAll(opener)].flatMap((match) => match[1] ?? match[2] ?? match[3] ?? []);
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
 *  where this repository does its explaining.
 *
 *  **A heredoc body is not a comment, whatever its lines begin with.** In a shell file a `#` at
 *  the start of a line means a comment everywhere except inside one, and `scripts/fixtures/` is
 *  almost nothing but heredocs: they write the sample files a page displays and the replay diffs
 *  byte for byte. A `# app configuration` inside one is a line of `config.conf`, so holding it to
 *  the guide would ask an author to edit something a comparison is pinned to, and the guide has
 *  nothing to say about a sample file in the first place.
 *
 *  A comment cannot open a heredoc, so openers are read from code lines only. Without that, a
 *  comment mentioning `<<EOF` would swallow every line beneath it. */
function commentLines(source: string, isShell: boolean): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inBlock = false;
  /** Delimiters still owed a terminator, oldest first. */
  let pending: string[] = [];

  source.split("\n").forEach((text, index) => {
    const trimmed = text.trimStart();

    if (pending.length) {
      // Matched against the trimmed line rather than column zero, because `<<-` strips leading
      // tabs from the terminator and a missed one would swallow the rest of the file.
      if (text.trim() === pending[0]) pending = pending.slice(1);
      return;
    }

    const isLineComment = trimmed.startsWith("//") || trimmed.startsWith("#");
    if (inBlock || isLineComment || trimmed.startsWith("/*")) {
      out.push({ line: index + 1, text });
      if (trimmed.startsWith("/*") && !trimmed.includes("*/")) inBlock = true;
      if (inBlock && trimmed.includes("*/")) inBlock = false;
      return;
    }
    if (isShell) pending = heredocDelimiters(text);
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

  if (isCode(path)) return commentLines(source, path.endsWith(SHELL_EXTENSION));

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

/** Consecutive prose lines joined into the paragraph they were wrapped from.
 *
 *  `src/content/proseBlocks.ts` asks a different question about different files: it pairs a prose
 *  page's command fence to the output fence below it, and the replay reads it to decide what a
 *  page claims. This one is about hard wrapping, and no file outside this one reads it.
 *
 *  **A rule matched line by line is wrong in both directions.** Prose here is hard-wrapped at
 *  around 100 columns, and a wrap falls wherever the column ran out rather than anywhere
 *  meaningful, so a construction the guide describes is as likely to straddle two lines as to sit
 *  on one. Matched per line, a tell split by a wrap is missed, and an exclusion split by one stops
 *  firing, which counts an honest phrase against a budget. The corpus had both: two "and nothing
 *  else" were being counted as findings because `else` had wrapped to the next line, and no rule
 *  here could ever have seen a tell that wrapped. Turning this on found a phrase §5 bans outright
 *  that had sat in the corpus unseen, on a page nobody had edited since.
 *
 *  A block ends at a blank line, and at any gap in the line numbers. The gap matters as much as
 *  the blank: `proseLines` drops fences, `code:` and captured output, so without it the sentence
 *  before a code block would be joined to the sentence after it and the rules would read across a
 *  join that is not in the file.
 *
 *  In an `examples.yaml` a line starting a new key ends the block too, since two fields are not
 *  one sentence however they are stacked. What that leaves joined is a folded scalar's
 *  continuation lines, which is the wrapped prose this exists for.
 *
 *  Offsets carry the line each character came from, so a finding still reports where to look. */
export function wrappedParagraphs(
  path: string,
  lines: { line: number; text: string }[],
): { text: string; lineAt: (index: number) => number }[] {
  const isExamples = path.endsWith(EXAMPLES_FILE);
  const blocks: { text: string; lineAt: (index: number) => number }[] = [];
  let parts: { text: string; line: number }[] = [];

  const flush = (): void => {
    if (!parts.length) return;
    const starts: { at: number; line: number }[] = [];
    let text = "";
    for (const part of parts) {
      if (text) text += " ";
      starts.push({ at: text.length, line: part.line });
      text += part.text.trim();
    }
    blocks.push({
      text,
      // `starts` is built fresh on each call and never reassigned, so the closure keeps this
      // block's offsets and not the next one's.
      lineAt: (index) => {
        let line = starts[0]?.line ?? 1;
        for (const start of starts) if (start.at <= index) line = start.line;
        return line;
      },
    });
    parts = [];
  };

  for (const entry of lines) {
    const previous = parts[parts.length - 1];
    const breaks =
      entry.text.trim() === "" ||
      (previous !== undefined && entry.line !== previous.line + 1) ||
      (isExamples && /^\s*-?\s*[a-z_]+:/.test(entry.text));
    if (breaks) flush();
    if (entry.text.trim() === "") continue;
    parts.push({ text: entry.text, line: entry.line });
  }
  flush();
  return blocks;
}

export function checkFile(absolute: string): Finding[] {
  const file = relative(ROOT, absolute);
  if (EXEMPT.has(file)) return [];
  if (EXEMPT_DIRS.some((dir) => resolve(absolute).startsWith(dir + sep))) return [];
  const findings: Finding[] = [];
  const lines = proseLines(file, readFileSync(absolute, "utf-8"));

  // Anchored rules keep the line: their patterns begin at `^` and mean the start of a caption,
  // which a joined block no longer offers anywhere but its first character.
  for (const { line, text } of lines) {
    for (const rule of RULES) {
      if (!rule.anchored) continue;
      for (const match of text.matchAll(rule.pattern)) findings.push({ file, line, rule, text: match[0] });
    }
  }

  for (const block of wrappedParagraphs(file, lines)) {
    for (const rule of RULES) {
      if (rule.anchored) continue;
      for (const match of block.text.matchAll(rule.pattern)) {
        findings.push({ file, line: block.lineAt(match.index ?? 0), rule, text: match[0] });
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
  // that the corpus sits at zero was true only of the files the checker happened to walk, and not
  // of the code beside them.
  join(ROOT, "src"),
  join(ROOT, "scripts"),
  join(ROOT, "test"),
];
const VOICE_FILES: readonly string[] = [join(ROOT, "README.md"), join(ROOT, "CLAUDE.md")];

/** Source files, checked for their comments and not for their code.
 *
 *  Shell is named on its own as well as listed, because it is the one of the two whose comment
 *  syntax has an exception: `commentLines` has to know not to read a heredoc body as prose. */
const SHELL_EXTENSION = ".sh";
const CODE_EXTENSIONS = [".ts", SHELL_EXTENSION];
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
    // Resolved against the working directory, which is where a name typed at the shell is
    // relative to. `checkFile` takes an absolute path and reports the finding against the root.
    targets = named.length ? named.map((path) => resolve(path)) : corpusFiles();
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
