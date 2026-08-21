// Replays the documented output on one prose page — a concept, scripting lesson, recipe or
// Debian article — inside a sandbox, and diffs it against what the page claims.
//
//   npx tsx scripts/verify-prose.ts <sandbox> <slug> [scripts/fixtures/<slug>.sh]
//
// The counterpart to verify-examples.ts, which does the same for command pages. Those carry
// their examples as YAML; a prose page states the same claim as a ```bash fence followed by
// the output it produced, which src/content/proseBlocks.ts pairs up.
//
// Without this, 96 output blocks across 15 pages were checked by nobody, and one of them had
// quietly drifted two Debian point releases out of date.
//
// Exit status: 0 when every pair reproduces, 1 on a mismatch, 2 on a bad argument.
import { existsSync } from "node:fs";
import { captureAll, openSandbox } from "./lib/sandbox.js";
import { COMPARISON, PROSE_CATEGORIES } from "../src/content/schema.js";
import { fixtureScript, proseSource } from "../src/paths.js";
import { MASK_TOKENS, normalise, shapeOf } from "./lib/normalise.js";
import { parseProseFile, type ProsePair } from "../src/content/proseBlocks.js";
import { ReplayError, readSetupDirectives } from "./lib/replay.js";
import { firstDifference, scoreLine } from "./lib/report.js";
import type { ReplayResult } from "./verify-examples.js";

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
 *  is an error if more than one answers to it — the slug namespace is per-category, so
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

  const matches = PROSE_CATEGORIES.filter((name) => existsSync(proseSource(name, reference)));
  const [only] = matches;
  if (!only) {
    throw new ReplayError(
      `no prose page with slug "${reference}" (looked in ${PROSE_CATEGORIES.join(", ")})`,
    );
  }
  if (matches.length > 1) {
    throw new ReplayError(
      `slug "${reference}" names ${matches.length} pages (${matches.map((c) => `${c}/${reference}`).join(", ")}) — say which one`,
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

  // A mask token in a documented output would match any real output for ever, because the
  // masks are idempotent. Same rule the command pages are held to.
  for (const pair of pairs) {
    const token = MASK_TOKENS.find((mask) => pair.output.includes(mask));
    if (token) {
      throw new ReplayError(
        `${pagePath}:${pair.line} documents the mask token ${token}, which would match anything.`,
      );
    }
  }
  const unexplained = skipped.find((pair) => !pair.note);
  if (unexplained) {
    throw new ReplayError(`${pagePath}:${unexplained.line} is skipped with no reason given.`);
  }

  const sandbox = openSandbox({
    name: options.sandbox,
    command: slug,
    tool: "prose",
    asUser: directives.asUser,
    needsSystemd: directives.needsSystemd,
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
      notes: [
        skipped.length ? `, ${skipped.length} skipped` : "",
        // Unpaired blocks are claims nothing checked. Reported rather than failed: a config
        // stanza is legitimately not command output, and the count is what tells an author
        // which is which.
        unpaired ? `, ${unpaired} block(s) not checkable` : "",
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
    console.error("usage: verify-prose.ts <sandbox> <slug> [setup.sh]");
    process.exit(2);
  }

  try {
    const result = replayProsePage({ sandbox, slug, setupPath });
    process.exit(result.mismatches === 0 ? 0 : 1);
  } catch (error) {
    if (!(error instanceof ReplayError)) throw error;
    console.error(error.message);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
