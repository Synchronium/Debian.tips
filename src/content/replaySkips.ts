// Reading a page's exemption list: the examples a batch run cannot reproduce.
//
// Pure and non-fatal, so it can be used by the build (which counts exemptions for the about
// page) as well as by the replay (which additionally refuses a stale entry and exits). Both
// need the same answer to "what does scripts/fixtures/<slug>.skip actually say", and until this
// existed each parsed the file with its own copy of the line filtering.
import { readFileSync } from "node:fs";
import { skipFile } from "../paths.js";

/** The titles listed in `scripts/fixtures/<slug>.skip`, in file order.
 *
 *  Comments (`#`) and blank lines are dropped; everything else is an example title, matched
 *  whole elsewhere. A page with no skip file exempts nothing and returns an empty list. */
export function readSkipEntries(slug: string, fixtureDir?: string): string[] {
  let source: string;
  try {
    source = readFileSync(skipFile(slug, fixtureDir), "utf-8");
  } catch {
    return [];
  }
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}
