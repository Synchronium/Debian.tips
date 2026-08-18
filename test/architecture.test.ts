import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { ExamplesFile } from "../src/content/schema.js";
import { PROSE_CATEGORIES } from "../src/content/schema.js";
import { CONTENT_DIR, EXAMPLES_FILE, FIXTURE_DIR, commandDir, proseSource } from "../src/paths.js";
import { parseProsePage } from "../scripts/lib/proseBlocks.js";

const COMMANDS_DIR = join(CONTENT_DIR, "commands");

/* An architecture in a documented output is the one defect that cannot fail in both places at
 * once: this devcontainer is arm64, a CI runner is amd64, and emulation isn't available here,
 * so the page passes locally and fails in CI or the reverse. It has cost a red CI more than
 * once, and it is invisible to every other check — the output is real, it reproduces perfectly,
 * and it is still wrong.
 *
 * The rule is about the package rather than the command. `Architecture: all` packages print
 * "all" everywhere, which is what lets the apt page document `apt list` and `apt show` at all;
 * `all` is therefore deliberately not in this list. */
const ARCHITECTURES = ["arm64", "amd64", "aarch64", "x86_64", "i386", "armhf", "ppc64el", "s390x"];
const PATTERN = new RegExp(`\\b(${ARCHITECTURES.join("|")})\\b`);

/** Every documented output on the site, as (where it is, what it claims). */
function documentedOutputs(): { where: string; output: string }[] {
  const found: { where: string; output: string }[] = [];

  for (const slug of readdirSync(COMMANDS_DIR)) {
    const file = join(commandDir(slug), EXAMPLES_FILE);
    const doc = parse(readFileSync(file, "utf-8")) as ExamplesFile;
    for (const section of doc.sections) {
      for (const example of section.examples) {
        if (example.output !== undefined)
          found.push({ where: `${slug}: ${example.title}`, output: example.output });
      }
    }
    for (const fixture of doc.fixtures ?? []) {
      found.push({ where: `${slug} fixture: ${fixture.name}`, output: fixture.content });
    }
  }

  for (const category of PROSE_CATEGORIES) {
    const dir = join(CONTENT_DIR, category);
    for (const filename of readdirSync(dir)) {
      if (!filename.endsWith(".md")) continue;
      const slug = filename.replace(/\.md$/, "");
      const { pairs } = parseProsePage(readFileSync(proseSource(category, slug), "utf-8"));
      for (const pair of pairs)
        found.push({ where: `${category}/${slug}:${pair.line}`, output: pair.output });
    }
  }

  return found;
}

describe("documented output", () => {
  it("never names a machine architecture", () => {
    const offenders = documentedOutputs()
      .filter(({ output }) => PATTERN.test(output))
      .map(({ where, output }) => `${where} — ${PATTERN.exec(output)![0]}`);
    expect(offenders).toEqual([]);
  });

  /* An exemption whose stated reason is the architecture is always a defect rather than a
   * record of how something was checked instead. It silences the replay while leaving the page
   * showing one machine's architecture to readers on the other — which is what `release-channels`
   * did from the day it shipped, and what nothing could report, because the exemption was itself
   * the thing suppressing the signal.
   *
   * There is always a fix: choose an `Architecture: all` package, or filter the field out of
   * the command's output. Both keep the example and remove the claim that cannot be true
   * everywhere. */
  it("is never exempted from checking because of the architecture", () => {
    const reasons: { where: string; reason: string }[] = [];

    for (const file of readdirSync(FIXTURE_DIR).filter((name) => name.endsWith(".skip"))) {
      for (const [index, line] of readFileSync(join(FIXTURE_DIR, file), "utf-8").split("\n").entries()) {
        if (line.trim().startsWith("#")) reasons.push({ where: `${file}:${index + 1}`, reason: line });
      }
    }

    for (const category of PROSE_CATEGORIES) {
      for (const filename of readdirSync(join(CONTENT_DIR, category))) {
        if (!filename.endsWith(".md")) continue;
        const slug = filename.replace(/\.md$/, "");
        const { pairs } = parseProsePage(readFileSync(proseSource(category, slug), "utf-8"));
        for (const pair of pairs) {
          if (pair.comparison === "skip")
            reasons.push({ where: `${category}/${slug}:${pair.line}`, reason: pair.note });
        }
      }
    }

    const excuse = /\b(architectures?|arm64|amd64|aarch64|x86_64|i386|armhf|ppc64el|s390x)\b/i;
    const offenders = reasons.filter(({ reason }) => excuse.test(reason)).map(({ where }) => where);
    expect(offenders).toEqual([]);
  });

  it("checks a meaningful number of blocks", () => {
    // A refactor that stopped finding the outputs would leave the check above passing on an
    // empty list, which is the failure mode a whitelist-style test has.
    expect(documentedOutputs().length).toBeGreaterThan(500);
  });
});
