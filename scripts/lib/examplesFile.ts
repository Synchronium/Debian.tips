// Reading a command page's examples.yaml, the way the build reads it.
//
// Parsed through the schema rather than cast to it: an assertion is the one spelling of "share
// the schema" that buys nothing at runtime, and it leaves a malformed file surfacing as a
// TypeError deep inside a loop, in tools that *edit* content.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { EXAMPLES_FILE, commandDir } from "../../src/paths.js";
import { type ExamplesFile, examplesFileSchema } from "../../src/content/schema.js";
import { ReplayError } from "./replayMetadata.js";
import { join } from "node:path";

/** Absolute path to a command page's examples file. Absolute because a tool may be run from
 *  anywhere, not only from the repository root. */
export function examplesPath(command: string): string {
  return join(commandDir(command), EXAMPLES_FILE);
}

/** Parses and validates one page's examples.yaml, reporting the same kind of message the loader
 *  gives rather than a TypeError from wherever the shape first disagreed.
 *
 *  Throws rather than exits, so one unparseable page is reported by the batch runner and the
 *  rest of the site still gets replayed. */
export function readExamplesFile(command: string): ExamplesFile {
  const path = examplesPath(command);
  const parsed = examplesFileSchema.safeParse(parse(readFileSync(path, "utf-8")));
  if (!parsed.success) {
    throw new ReplayError(
      `${path}: invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  if (parsed.data.command !== command) {
    throw new ReplayError(`${path}: command "${parsed.data.command}" does not match directory "${command}"`);
  }
  return parsed.data;
}
