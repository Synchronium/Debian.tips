import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPARISON, PROSE_CATEGORIES } from "../src/content/schema.js";
import { CONTENT_DIR, FIXTURE_DIR, commandsDir, proseSlug, proseSource } from "../src/paths.js";
import { parseProsePage } from "../src/content/proseBlocks.js";
import { partitionExamples } from "../src/content/pageChecks.js";
import { readExamplesFile } from "../scripts/lib/examplesFile.js";

/* ADR-0029. Inside the sandbox, memory, swap, load and CPU figures belong to whichever machine runs
 * the container, so a compared output carrying one reproduces on that machine only. It is the
 * defect `test/architecture.test.ts` looks for, in numbers rather than in a word, and a block
 * showing one belongs in the page's exemptions, with a proof example checking what the page says
 * about it.
 *
 * Each signature is a line only a host figure prints. `top`'s `Tasks:` line is left out on purpose:
 * it counts the container's own processes, which the page's setup script decides. */
const SIGNATURES: { name: string; pattern: RegExp; sample: string }[] = [
  {
    name: "free's memory and swap rows",
    pattern: /^(Mem|Swap):\s+\S/m,
    sample: "Mem:         4010356     2360820      637020       25440     1225360     1649536",
  },
  {
    name: "top's memory and swap rows",
    pattern: /^[KMGT]iB (Mem|Swap) ?:/m,
    sample: "MiB Mem :   3916.4 total,    621.6 free,   2303.9 used,   1198.8 buff/cache",
  },
  {
    name: "top's CPU row",
    pattern: /^%Cpu\(s\):/m,
    sample: "%Cpu(s):  1.1 us,  0.0 sy,  0.0 ni, 93.2 id,  5.7 wa,  0.0 hi,  0.0 si,  0.0 st",
  },
  {
    name: "a load average, as uptime, w and top print it",
    pattern: /load average:/,
    sample: " 12:52:46 up 4 days, 20:25,  0 users,  load average: 0.40, 0.33, 0.32",
  },
  {
    name: "/proc/meminfo's totals",
    pattern: /^Mem(Total|Free|Available):\s/m,
    sample: "MemTotal:        4010356 kB",
  },
];

/** Every output the replay compares, as (where it is, what it claims). Exempt blocks are left out,
 *  because an exempt block is where a host figure belongs. */
function comparedOutputs(): { where: string; output: string }[] {
  const found: { where: string; output: string }[] = [];

  for (const slug of readdirSync(commandsDir())) {
    const doc = readExamplesFile(slug);
    for (const example of partitionExamples(doc, slug, FIXTURE_DIR).checked)
      found.push({ where: `${slug}: ${example.title}`, output: example.output ?? "" });
    for (const fixture of doc.fixtures ?? [])
      found.push({ where: `${slug} fixture: ${fixture.name}`, output: fixture.content });
  }

  for (const category of PROSE_CATEGORIES) {
    for (const filename of readdirSync(join(CONTENT_DIR, category))) {
      const slug = proseSlug(filename);
      if (slug === null) continue;
      const { pairs } = parseProsePage(readFileSync(proseSource(category, slug), "utf-8"));
      for (const pair of pairs.filter((pair) => pair.comparison !== COMPARISON.skip))
        found.push({ where: `${category}/${slug}:${pair.line}`, output: pair.output });
    }
  }

  return found;
}

describe("a compared output", () => {
  it("never shows a figure that belongs to the host", () => {
    const offenders = comparedOutputs().flatMap(({ where, output }) =>
      SIGNATURES.filter(({ pattern }) => pattern.test(output)).map(({ name }) => `${where}: ${name}`),
    );
    expect(offenders).toEqual([]);
  });

  /* A pattern that has stopped matching what the command prints would pass every page above while
   * checking nothing. Each sample is a line the command really printed in the sandbox, so a
   * signature edited out of step with its command fails here instead. */
  it.each(SIGNATURES)("recognises $name", ({ pattern, sample }) => {
    expect(pattern.test(sample)).toBe(true);
  });

  it("is looked for across the whole site", () => {
    // As in the architecture test: a refactor that stopped finding the outputs would leave the
    // first test passing on an empty list.
    expect(comparedOutputs().length).toBeGreaterThan(500);
  });
});
