import { describe, expect, it } from "vitest";
import { ADOPT_ALL, selectAdoptTargets } from "../scripts/lib/adoptTargets.js";

/* `scripts/authoring/adopt-real-output.ts` replaces what a page claims a command printed, so a
 * selection bug does not fail loudly: it writes a real capture into the wrong example's block,
 * and every gate afterwards agrees, because the output really was captured and the page really
 * does match it. The two properties that keep that from happening are whole-title matching and
 * the index each target carries, and both are asserted below. */

const EXAMPLES = [
  { title: "Find symlinks", code: "find . -type l" },
  { title: "Find symlinks that point to a regular file", code: "find . -type l -xtype f" },
  { title: "Count matches", code: "grep -c TODO notes.txt" },
  { title: "Watch a log", code: "tail -f access.log" },
];

const NOTHING_SKIPPED: ReadonlySet<string> = new Set();

describe("selectAdoptTargets", () => {
  it("matches a title whole, never as a prefix", () => {
    // "Find symlinks" is a prefix of the example after it. Taking the longer one would write the
    // capture of one command into the other's block, and the file gives no way to notice.
    const { targets } = selectAdoptTargets(EXAMPLES, NOTHING_SKIPPED, ["Find symlinks"]);
    expect(targets.map((target) => target.example.title)).toEqual(["Find symlinks"]);
  });

  it("gives each target the index its capture arrives under", () => {
    // Captures come back keyed by position in `adoptable`, so a target carrying the wrong index
    // adopts a different command's output. This is the assertion that pins the two together.
    const { adoptable, targets } = selectAdoptTargets(EXAMPLES, NOTHING_SKIPPED, ["Watch a log"]);
    const target = targets[0];
    expect(target).toBeDefined();
    expect(adoptable[target?.index ?? -1]?.code).toBe("tail -f access.log");
  });

  it("keeps the indices pointing at the right examples when something is skipped", () => {
    // The skipped example is removed before the indices are handed out, so every later one shifts
    // down by a place. Indexing into the unfiltered list instead would adopt output that belongs
    // to the example after each target.
    const skipped: ReadonlySet<string> = new Set(["Find symlinks"]);
    const { adoptable, targets } = selectAdoptTargets(EXAMPLES, skipped, [ADOPT_ALL]);
    for (const target of targets) expect(adoptable[target.index]).toBe(target.example);
    expect(adoptable.map((example) => example.title)).not.toContain("Find symlinks");
  });

  it("excludes an example the .skip file exempts", () => {
    // A skip entry names an example the replay cannot run. Capturing one records whatever the
    // failure to run it printed, and adopting that publishes it as the command's output.
    const skipped: ReadonlySet<string> = new Set(["Watch a log"]);
    const { adoptable, targets } = selectAdoptTargets(EXAMPLES, skipped, [ADOPT_ALL]);
    expect(adoptable.map((example) => example.title)).not.toContain("Watch a log");
    expect(targets.map((target) => target.example.title)).not.toContain("Watch a log");
  });

  it("reports a skipped example asked for by name rather than ignoring it", () => {
    // The caller asked for something this tool will not do. Silently adopting nothing reads as
    // success, and the example they meant to fix stays wrong.
    const skipped: ReadonlySet<string> = new Set(["Watch a log"]);
    const { targets, missing } = selectAdoptTargets(EXAMPLES, skipped, ["Watch a log"]);
    expect(targets).toEqual([]);
    expect(missing).toEqual(["Watch a log"]);
  });

  it("reports a mistyped title", () => {
    const { missing } = selectAdoptTargets(EXAMPLES, NOTHING_SKIPPED, ["Count matchs"]);
    expect(missing).toEqual(["Count matchs"]);
  });

  it("reports only the titles that missed, alongside the ones that hit", () => {
    const { targets, missing } = selectAdoptTargets(EXAMPLES, NOTHING_SKIPPED, [
      "Count matches",
      "No such example",
    ]);
    expect(targets.map((target) => target.example.title)).toEqual(["Count matches"]);
    expect(missing).toEqual(["No such example"]);
  });

  it("takes every adoptable example under --all", () => {
    const { adoptable, targets } = selectAdoptTargets(EXAMPLES, NOTHING_SKIPPED, [ADOPT_ALL]);
    expect(targets).toHaveLength(adoptable.length);
    expect(targets.map((target) => target.index)).toEqual([0, 1, 2, 3]);
  });

  it("cannot miss under --all", () => {
    // `--all` asks for whatever is there, so it has nothing to fail to find, even on a page where
    // every example is skipped.
    const allSkipped: ReadonlySet<string> = new Set(EXAMPLES.map((example) => example.title));
    const { targets, missing } = selectAdoptTargets(EXAMPLES, allSkipped, [ADOPT_ALL]);
    expect(targets).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("keeps targets in file order", () => {
    // The caller rewrites last-first so each splice leaves the earlier line numbers intact, which
    // only holds if the targets arrive in the order they appear in the file.
    const { targets } = selectAdoptTargets(EXAMPLES, NOTHING_SKIPPED, ["Watch a log", "Find symlinks"]);
    expect(targets.map((target) => target.example.title)).toEqual(["Find symlinks", "Watch a log"]);
  });
});
