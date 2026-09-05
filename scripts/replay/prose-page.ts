// Replays the documented output on one prose page (a concept, scripting lesson, recipe or
// Debian article) inside a sandbox, and diffs it against what the page claims.
//
//   npx tsx scripts/replay/prose-page.ts <sandbox> <slug> [scripts/fixtures/<slug>.sh]
//
// The counterpart to command-page.ts beside it. A command page carries its examples as YAML; a
// prose page states the same claim as a ```bash fence followed by the output it produced, which
// src/content/proseBlocks.ts pairs up.
//
// Exit status: 0 when every pair reproduces, 1 on a mismatch, 2 on a bad argument.
import { existsSync } from "node:fs";
import { SANDBOX_TOOL, captureAll, openSandbox } from "../lib/sandbox.js";
import { COMPARISON, PROSE_CATEGORIES, type ProseCategory } from "../../src/content/schema.js";
import { fixtureScript, proseSource } from "../../src/paths.js";
import { normalise, refuseMaskTokens, shapeOf } from "../lib/normalise.js";
import { parseProseFile, type ProsePair } from "../../src/content/proseBlocks.js";
import { ReplayError, readSetupDirectives } from "../lib/replayMetadata.js";
import { categoriesOf } from "../lib/replayPages.js";
import { type ReplayResult, firstDifference, runAsCommand, scoreLine } from "../lib/replayReport.js";

interface Mismatch {
  pair: ProsePair;
  want: string;
  got: string;
}

export interface ProseReplayOptions {
  sandbox: string;
  /** Page slug, e.g. "pipes-and-redirection". Qualified as `category/slug` when two pages in
   *  different categories share a slug. */
  slug: string;
  setupPath?: string | undefined;
}

/** Finds the prose page a slug names. A bare slug is looked for in every prose category, and
 *  is an error if more than one answers to it, since the slug namespace is per-category, so
 *  `recipes/find` is how you say which one you mean. */
function locate(reference: string): { category: string; slug: string; path: string } {
  if (reference.includes("/")) {
    const [category = "", slug = ""] = reference.split("/", 2);
    const path = proseSource(category, slug);
    if (!(PROSE_CATEGORIES as readonly string[]).includes(category) || !existsSync(path)) {
      throw new ReplayError(`no prose page at "${reference}"`);
    }
    return { category, slug, path };
  }

  const matches = categoriesOf(reference).filter((name): name is ProseCategory =>
    (PROSE_CATEGORIES as readonly string[]).includes(name),
  );
  const [only] = matches;
  if (!only) {
    throw new ReplayError(
      `no prose page with slug "${reference}" (looked in ${PROSE_CATEGORIES.join(", ")})`,
    );
  }
  if (matches.length > 1) {
    throw new ReplayError(
      `slug "${reference}" names ${matches.length} pages (${matches.map((c) => `${c}/${reference}`).join(", ")}): say which one`,
    );
  }
  return { category: only, slug: reference, path: proseSource(only, reference) };
}

export function replayProsePage(options: ProseReplayOptions): ReplayResult {
  const { slug, path: pagePath } = locate(options.slug);

  const setupPath = options.setupPath ?? (existsSync(fixtureScript(slug)) ? fixtureScript(slug) : undefined);
  const directives = readSetupDirectives(setupPath);

  const { pairs, unpaired } = parseProseFile(pagePath);
  const runnable = pairs.filter((pair) => pair.comparison !== COMPARISON.skip);
  const skipped = pairs.filter((pair) => pair.comparison === COMPARISON.skip);

  // Unpaired blocks are held to the same rule as pairs: nothing compares them, so a mask there
  // cannot weaken a comparison, but it would render to the reader as a literal `<TIMESTAMP>` in
  // something presented as real output.
  refuseMaskTokens(
    pagePath,
    [...pairs, ...unpaired].map((block) => ({ where: `${pagePath}:${block.line}`, text: block.output })),
  );
  // Both ways of leaving an output block unreproduced have to say why, and for the same reason:
  // the page's footer tells a reader how many blocks are exempt and points them at the page
  // source for the reasons, so a block with no reason there makes the footer promise something
  // that is not written down. An unpaired fence used to be the way round this, being reported as
  // a count and required to explain nothing. See ADR-0021.
  const unexplained = [
    ...skipped.filter((pair) => !pair.note).map((pair) => pair.line),
    ...unpaired.filter((block) => !block.note).map((block) => block.line),
  ].sort((a, b) => a - b);
  if (unexplained.length) {
    throw new ReplayError(
      `${pagePath}: ${unexplained.length} output block(s) are not reproduced and give no reason:\n` +
        unexplained.map((line) => `  ${pagePath}:${line}`).join("\n") +
        `\nPut "<!-- verify: skip <why> -->" on the line above each, which is what the page's own ` +
        `"N are exempt" sentence sends a reader to look for.`,
    );
  }

  const sandbox = openSandbox({
    name: options.sandbox,
    command: slug,
    tool: SANDBOX_TOOL.prosePage,
    asUser: directives.asUser,
    flavour: directives.flavour,
    setupPath,
  });

  const captured = captureAll(
    sandbox,
    runnable.map((pair) => pair.command),
  );

  const mismatches: Mismatch[] = [];
  let shapeMatches = 0;
  let matches = 0;

  runnable.forEach((pair, index) => {
    const compare = pair.comparison === COMPARISON.shape ? shapeOf : normalise;
    const want = compare(pair.output);
    const got = compare(captured.get(index) ?? "");
    if (want === got) {
      matches++;
      if (pair.comparison === COMPARISON.shape) shapeMatches++;
    } else {
      mismatches.push({ pair, want, got });
    }
  });

  console.log(
    scoreLine({
      page: slug,
      asUser: directives.asUser,
      matched: matches,
      total: runnable.length,
      shapeMatches,
      // A prose page has no way to spell `unordered:`; ADR-0026 says what adding one would take.
      unorderedMatches: 0,
      notes: [
        // Kept apart in the tool's own output, though the page states them as one figure. They
        // are the same claim to a reader and different work to an author: a skipped pair has a
        // command that could in principle be run, and an unpaired block has none.
        skipped.length ? `, ${skipped.length} skipped` : "",
        unpaired.length ? `, ${unpaired.length} unpaired` : "",
      ],
    }),
  );

  for (const mismatch of mismatches) {
    console.log(`--- ${pagePath}:${mismatch.pair.line}`);
    console.log(`    $ ${mismatch.pair.command.split("\n")[0]}`);
    console.log(firstDifference(mismatch.want, mismatch.got));
  }

  return { page: slug, matched: matches, total: runnable.length, mismatches: mismatches.length };
}

function main(): void {
  const [sandbox, slug, setupPath] = process.argv.slice(2);
  if (!sandbox || !slug) {
    console.error("usage: prose-page.ts <sandbox> <slug> [setup.sh]");
    process.exit(2);
  }
  runAsCommand(() => replayProsePage({ sandbox, slug, setupPath }));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
