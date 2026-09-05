import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../src/paths.js";

/* ADR-0028: `scripts/` imports from `src/`, and `src/` never imports from `scripts/`.
 *
 * The generator has to run in CI's `check` job, in the dev server and on a machine with no Docker,
 * so it cannot depend on a harness that shells out to containers. The rule is easy to break by
 * accident, because the thing a template wants is usually a figure the harness already computes:
 * `src/content/replayTimings.ts` exists precisely so that reaching into `scripts/` for the recorded
 * seconds is never the shortest path. Broken, this fails at runtime rather than at build time, and
 * only on the machine that has no Docker. */

/** Any import or re-export specifier, whether or not it is type-only: `import … from "x"`,
 *  `export … from "x"`, and the dynamic `import("x")`. Static and dynamic both, because a dynamic
 *  one loads the module just the same and is the form that would slip through a check for the
 *  keyword alone. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith(".ts")
        ? [join(dir, entry.name)]
        : [],
  );
}

/** Whether a specifier resolves into `scripts/`. Relative specifiers are what this is looking for:
 *  a file in `src/` reaches the harness as `../scripts/…` or `../../scripts/…`, and nothing else
 *  in the repository is spelled that way. A bare package name is a dependency, not a neighbour. */
function reachesScripts(specifier: string): boolean {
  return /^\.{1,2}\//.test(specifier) && specifier.split("/").includes("scripts");
}

describe("the module boundary between the generator and the harness", () => {
  it("has no import from src/ into scripts/", () => {
    const violations: string[] = [];
    for (const file of sourceFiles("src")) {
      const source = readFileSync(join(ROOT, file), "utf-8");
      for (const match of source.matchAll(SPECIFIER)) {
        const specifier = match[1];
        if (specifier !== undefined && reachesScripts(specifier)) {
          violations.push(`${file} imports ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  // The other direction is the arrangement working rather than a thing to police, so this asserts
  // it happens at all: a zero here would mean the two halves had stopped sharing the contract, and
  // the duplicate definitions ADR-0028 exists to prevent had already been written.
  it("has the harness importing the shared contract from src/", () => {
    const importers = sourceFiles("scripts").filter((file) => {
      const source = readFileSync(join(ROOT, file), "utf-8");
      return [...source.matchAll(SPECIFIER)].some(
        (match) =>
          match[1] !== undefined && /^\.{1,2}\//.test(match[1]) && match[1].split("/").includes("src"),
      );
    });
    expect(importers.length).toBeGreaterThan(0);
  });
});
