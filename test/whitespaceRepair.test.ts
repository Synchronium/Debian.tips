import { describe, expect, it } from "vitest";
import { REPAIR, classifyRepair, trimEdges, withoutIndentation } from "../scripts/lib/whitespaceRepair.js";

/* `scripts/authoring/fix-output-whitespace.ts` rewrites examples.yaml in place, and this module is
 * the only thing deciding which blocks it may touch. The failure that matters is not a repair it
 * declines: it is a repair it makes to a block that differs in substance, because the page then
 * claims output no command produced and the replay agrees, having been handed the capture as the
 * truth. Every case below is either a difference that must be repaired or one that must not be. */

describe("classifyRepair: what may be rewritten", () => {
  it("repairs the padding a bare | strips", () => {
    // `wc` right-aligns its counts, and a block written with a plain `|` takes its strip width
    // from the first line, so the shorter later lines lose the padding that lines the column up.
    const captured = "    40 report.txt\n     9 wordlist.txt\n    49 total";
    const documented = "40 report.txt\n 9 wordlist.txt\n49 total";
    expect(classifyRepair(captured, documented)).toBe(REPAIR.indentation);
  });

  it("leaves a block alone when a value changed", () => {
    expect(classifyRepair("    41 report.txt", "    40 report.txt")).toBe(REPAIR.substance);
  });

  it("leaves a block alone when a line was added", () => {
    // Indentation cannot account for a line that was not there, so this is the page and the
    // command disagreeing, and nothing here can know which one is wrong.
    expect(classifyRepair("40 report.txt\n49 total", "40 report.txt")).toBe(REPAIR.substance);
  });

  it("leaves a block alone when lines were reordered", () => {
    expect(classifyRepair("beta\nalpha", "alpha\nbeta")).toBe(REPAIR.substance);
  });

  it("does not treat spacing inside a line as padding", () => {
    // Only *leading* whitespace is discounted. Collapsing runs of spaces anywhere would make a
    // column that genuinely changed width look like padding and be overwritten as one.
    expect(classifyRepair("40  report.txt", "40 report.txt")).toBe(REPAIR.substance);
  });

  it("reports agreement rather than repairing when only trailing space differs", () => {
    // Nothing a reader can see, so a rewrite would produce a new mtime and an empty diff.
    expect(classifyRepair("40 report.txt   ", "40 report.txt")).toBe(REPAIR.unchanged);
  });

  it("reports agreement when only blank edges differ", () => {
    expect(classifyRepair("\n\n40 report.txt\n", "40 report.txt")).toBe(REPAIR.unchanged);
  });

  it("treats a capture that came back empty as a difference in substance", () => {
    // An empty capture means the command printed nothing this run. Writing it over the block
    // would delete a page's documented output and call it a whitespace fix.
    expect(classifyRepair("", "40 report.txt")).toBe(REPAIR.substance);
  });
});

describe("trimEdges", () => {
  it("removes trailing whitespace on every line, not just the last", () => {
    expect(trimEdges("one   \ntwo\t\nthree")).toBe("one\ntwo\nthree");
  });

  it("keeps blank lines inside the block", () => {
    // A blank line in the middle is output the command produced, and pages document it.
    expect(trimEdges("one\n\ntwo")).toBe("one\n\ntwo");
  });

  it("keeps leading whitespace, which is the whole subject", () => {
    expect(trimEdges("    40 report.txt")).toBe("    40 report.txt");
  });
});

describe("withoutIndentation", () => {
  it("makes two differently padded blocks comparable", () => {
    expect(withoutIndentation("    40 report.txt\n     9 wordlist.txt")).toBe(
      withoutIndentation("40 report.txt\n9 wordlist.txt"),
    );
  });

  it("keeps blocks distinguishable when their content differs", () => {
    expect(withoutIndentation("    40 report.txt")).not.toBe(withoutIndentation("    41 report.txt"));
  });
});
