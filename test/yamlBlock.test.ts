import { describe, expect, it } from "vitest";
import { findOutputBlock, replaceOutputBlock } from "../scripts/lib/yamlBlock.js";

/* These two functions rewrite `examples.yaml` in place, which makes them the highest-stakes
 * untested code in the repository: a bug here corrupts a page's documented output, and
 * adopt-real-output.ts then re-certifies the corruption as "what the command printed". The
 * padding cases are the same hazard test/normalise.test.ts exists for, from the other end —
 * `wc` and `uniq -c` right-align their first column, and a block written with a bare `|`
 * silently loses exactly that padding. */

const FILE = `command: wc
sections:
  - title: "Counting"
    examples:
      - title: "Count lines"
        code: wc -l report.txt
        description: Counts lines.
        level: basic
        output: |2
          40 report.txt
      - title: "Count lines in every file"
        code: wc -l *.txt
        description: Counts each, then a total.
        level: basic
        output: |2
              40 report.txt
               9 wordlist.txt
              49 total
      - title: "Count words"
        code: wc -w report.txt
        description: No output block on this one.
        level: basic
`.split("\n");

describe("findOutputBlock", () => {
  it("finds the block belonging to a title", () => {
    const lookup = findOutputBlock([...FILE], "Count lines");
    expect(lookup.found).toBe(true);
    if (!lookup.found) return;
    expect(FILE[lookup.block.keyLine]).toBe("        output: |2");
    expect(FILE.slice(lookup.block.keyLine + 1, lookup.block.end)).toEqual(["          40 report.txt"]);
  });

  it("matches a title whole, never as a prefix", () => {
    // "Count lines" is a prefix of "Count lines in every file". Resolving to the longer one
    // would write one example's output into the other's block.
    const lookup = findOutputBlock([...FILE], "Count lines in every file");
    expect(lookup.found).toBe(true);
    if (!lookup.found) return;
    expect(FILE.slice(lookup.block.keyLine + 1, lookup.block.end)).toEqual([
      "              40 report.txt",
      "               9 wordlist.txt",
      "              49 total",
    ]);
  });

  it("reports an example that documents no output", () => {
    const lookup = findOutputBlock([...FILE], "Count words");
    expect(lookup).toEqual({ found: false, reason: "no-output-block" });
  });

  it("reports a title that matches nothing", () => {
    expect(findOutputBlock([...FILE], "Not on this page")).toEqual({
      found: false,
      reason: "title-matches",
      count: 0,
    });
  });

  it("reports a title that matches twice rather than picking one", () => {
    const doubled = [...FILE, ...FILE.slice(2)];
    const lookup = findOutputBlock(doubled, "Count lines");
    expect(lookup).toEqual({ found: false, reason: "title-matches", count: 2 });
  });
});

describe("replaceOutputBlock", () => {
  it("writes an explicit |2 indicator and indents the body under it", () => {
    const lines = [...FILE];
    const lookup = findOutputBlock(lines, "Count lines");
    if (!lookup.found) throw new Error("fixture no longer has the block this test needs");

    const updated = replaceOutputBlock(lines, lookup.block, "41 report.txt");
    expect(updated.slice(lookup.block.keyLine, lookup.block.keyLine + 2)).toEqual([
      "        output: |2",
      "          41 report.txt",
    ]);
  });

  it("keeps leading padding that a bare | would strip", () => {
    // The first line is indented further than the rest. Under a bare `|`, YAML takes the block's
    // strip width from that first line and every later line loses two columns — the documented
    // output silently stops matching what the command prints.
    const lines = [...FILE];
    const lookup = findOutputBlock(lines, "Count lines in every file");
    if (!lookup.found) throw new Error("fixture no longer has the block this test needs");

    const updated = replaceOutputBlock(lines, lookup.block, "     40 report.txt\n      9 wordlist.txt");
    expect(updated.slice(lookup.block.keyLine, lookup.block.keyLine + 3)).toEqual([
      "        output: |2",
      "               40 report.txt",
      "                9 wordlist.txt",
    ]);
  });

  it("leaves a blank line blank rather than indenting whitespace onto it", () => {
    const lines = [...FILE];
    const lookup = findOutputBlock(lines, "Count lines");
    if (!lookup.found) throw new Error("fixture no longer has the block this test needs");

    const updated = replaceOutputBlock(lines, lookup.block, "one\n\ntwo");
    expect(updated.slice(lookup.block.keyLine + 1, lookup.block.keyLine + 4)).toEqual([
      "          one",
      "",
      "          two",
    ]);
  });

  it("leaves the rest of the file untouched", () => {
    const lines = [...FILE];
    const lookup = findOutputBlock(lines, "Count lines");
    if (!lookup.found) throw new Error("fixture no longer has the block this test needs");

    const updated = replaceOutputBlock(lines, lookup.block, "41 report.txt");
    expect(updated[0]).toBe("command: wc");
    expect(updated).toContain('      - title: "Count words"');
    expect(updated.filter((line) => line.includes("wordlist.txt"))).toHaveLength(1);
  });
});
