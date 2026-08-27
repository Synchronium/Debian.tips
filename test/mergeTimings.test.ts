import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MERGE,
  MOVED_FRACTION,
  MOVED_SECONDS,
  combineParts,
  hasMoved,
  mergeTimings,
  partFiles,
} from "../scripts/lib/mergeTimings.js";

/* `.github/workflows/record-timings.yml` writes `scripts/replay-timings.json` from artifacts, on
 * main, with a token that can push. That is the one script here whose only home is a workflow, so
 * it is also the one whose behaviour was previously established by pushing and watching.
 *
 * What is worth holding is that it refuses in every case where a write would be worse than
 * staleness. A hole is the case that matters most and shows least: a page missing from the parts
 * and a page never recorded are the same absence in the file afterwards, and both merely balance
 * worse, so nothing downstream can tell the two apart or complain about either. */

const temp: string[] = [];
function partsDir(parts: Record<string, unknown>[], nested = false): string {
  const dir = mkdtempSync(join(tmpdir(), "merge-timings-"));
  temp.push(dir);
  parts.forEach((part, i) => {
    // The layout `actions/download-artifact` produces for a pattern: one directory per artifact.
    const at = nested ? join(dir, `replay-timings-${i + 1}`) : dir;
    if (nested) mkdirSync(at, { recursive: true });
    writeFileSync(join(at, `shard-${i + 1}.json`), JSON.stringify(part));
  });
  return dir;
}

afterEach(() => {
  for (const dir of temp.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const site = ["commands/ls", "commands/tar", "concepts/paths"];
const whole = { "commands/ls": 2, "commands/tar": 7, "concepts/paths": 3 };
const merge = (merged: Record<string, number>, current: Record<string, number>, overlapping: string[] = []) =>
  mergeTimings({ expected: site, merged, overlapping, current });

describe("collecting the parts a sharded replay leaves", () => {
  it("finds them however download-artifact laid them out", () => {
    expect(partFiles(partsDir([{ a: 1 }, { b: 2 }])).length).toBe(2);
    expect(partFiles(partsDir([{ a: 1 }, { b: 2 }], true)).length).toBe(2);
  });

  it("ignores files that are not parts", () => {
    const dir = partsDir([{ "commands/ls": 2 }]);
    writeFileSync(join(dir, "notes.txt"), "not a part");
    expect(partFiles(dir).length).toBe(1);
  });

  it("combines them and names any page that arrived twice", () => {
    const files = partFiles(partsDir([{ "commands/ls": 2 }, { "commands/ls": 9, "commands/tar": 7 }]));
    const { merged, overlapping } = combineParts(files);
    expect(overlapping).toEqual(["commands/ls"]);
    expect(merged["commands/tar"]).toBe(7);
  });

  it("drops a part it cannot read rather than throwing", () => {
    // The page it should have carried then reports as a hole, which is what stops the write. A
    // throw would have been a stack trace naming a file in a temporary directory instead.
    const dir = partsDir([{ "commands/ls": 2 }]);
    writeFileSync(join(dir, "truncated.json"), '{"commands/tar": 7');
    const { merged } = combineParts(partFiles(dir));
    expect(Object.keys(merged)).toEqual(["commands/ls"]);
    expect(merge(merged, whole).kind).toBe(MERGE.incomplete);
  });

  it("drops entries that are not a duration", () => {
    const files = partFiles(partsDir([{ "commands/ls": -4, "commands/tar": "slow", "concepts/paths": 3 }]));
    expect(Object.keys(combineParts(files).merged)).toEqual(["concepts/paths"]);
  });
});

describe("deciding whether to write the timings", () => {
  it("refuses when the parts do not cover the site", () => {
    const result = merge({ "commands/ls": 2, "commands/tar": 7 }, whole);
    expect(result.kind).toBe(MERGE.incomplete);
    if (result.kind !== MERGE.incomplete) throw new Error("unreachable");
    expect(result.missing).toEqual(["concepts/paths"]);
    expect(result.covered).toBe(2);
  });

  it("refuses when a page arrived in more than one part", () => {
    // Shards are disjoint, so this is not one run's worth of parts: two attempts downloaded
    // together, or a matrix that changed size mid-flight.
    const result = merge(whole, whole, ["commands/ls", "commands/ls"]);
    expect(result.kind).toBe(MERGE.overlapping);
    if (result.kind !== MERGE.overlapping) throw new Error("unreachable");
    expect(result.pages).toEqual(["commands/ls"]);
  });

  it("checks for holes before it checks anything about drift", () => {
    // Incompleteness is the finding worth reporting, and a run missing a page is usually also a
    // run whose remaining figures moved. Reporting the drift would bury it.
    expect(merge({ "commands/ls": 2 }, {}).kind).toBe(MERGE.incomplete);
  });

  it("writes for a page that was not timed before", () => {
    const result = merge(whole, { "commands/ls": 2, "commands/tar": 7 });
    expect(result.kind).toBe(MERGE.write);
    if (result.kind !== MERGE.write) throw new Error("unreachable");
    expect(result.added).toEqual(["concepts/paths"]);
    expect(result.next).toEqual(whole);
  });

  it("writes for a page that no longer replays, and drops it", () => {
    const result = merge(whole, { ...whole, "commands/gone": 4 });
    expect(result.kind).toBe(MERGE.write);
    if (result.kind !== MERGE.write) throw new Error("unreachable");
    expect(result.removed).toEqual(["commands/gone"]);
    expect(result.next["commands/gone"]).toBeUndefined();
  });

  it("leaves the file alone when nothing moved enough to be worth a commit", () => {
    const result = merge({ "commands/ls": 2.4, "commands/tar": 7.3, "concepts/paths": 2.8 }, whole);
    expect(result.kind).toBe(MERGE.unchanged);
  });

  it("ignores a recorded page the parts no longer carry, when nothing else changed", () => {
    // A page whose setup script went away in a commit after the run started is surplus rather than
    // a hole. It is reported, and on its own it is not worth a commit.
    const result = merge({ ...whole, "commands/gone": 4 }, whole);
    expect(result.kind).toBe(MERGE.unchanged);
    if (result.kind !== MERGE.unchanged) throw new Error("unreachable");
    expect(result.surplus).toEqual(["commands/gone"]);
  });

  it("records figures whatever they do to the shard count", () => {
    // The merge has no opinion about the count, on purpose. It can write only the figures, and a
    // workflow cannot write the workflow file the count lives in, so refusing to record until the
    // two agreed left neither able to move: no recording without the matrix change, and no matrix
    // change the committed figures justified. `npm run shards` asks the question afterwards.
    // 7 to 40 seconds on the heaviest of three pages is exactly the shape that moves the curve.
    const result = merge({ ...whole, "commands/tar": 40 }, whole);
    expect(result.kind).toBe(MERGE.write);
    if (result.kind !== MERGE.write) throw new Error("unreachable");
    expect(result.next["commands/tar"]).toBe(40);
  });

  it("writes every page's figure once any page has moved", () => {
    // The file is replaced whole rather than patched, so a page that drifted below the bar is
    // still brought up to date by a commit some other page earned.
    const result = merge({ "commands/ls": 2.4, "commands/tar": 20, "concepts/paths": 3 }, whole);
    expect(result.kind).toBe(MERGE.write);
    if (result.kind !== MERGE.write) throw new Error("unreachable");
    expect(result.moved).toEqual(["commands/tar"]);
    expect(result.next["commands/ls"]).toBe(2.4);
  });
});

describe("what counts as a page having moved", () => {
  it("ignores anything under the absolute bar, however large a share of the page it is", () => {
    expect(hasMoved(0.5, 0.5 + MOVED_SECONDS / 2)).toBe(false);
  });

  it("catches a heavy page that really has changed", () => {
    expect(hasMoved(60, 80)).toBe(true);
  });

  it("ignores a rounding error on a heavy page", () => {
    expect(hasMoved(60, 63)).toBe(false);
  });

  it("is symmetric: a page getting quicker is drift too", () => {
    expect(hasMoved(60, 40)).toBe(hasMoved(40, 60));
  });

  it("holds a light page to the absolute bar and nothing else", () => {
    // The half of the filter that is not there for most of this site, asserted so that nobody
    // reasons from the fraction about a page it cannot bind. Below the crossover a fifth of the
    // page is a fraction of a second, met by anything that cleared two seconds long ago.
    const light = MOVED_SECONDS / MOVED_FRACTION / 2;
    expect(light * MOVED_FRACTION).toBeLessThan(MOVED_SECONDS);
    expect(hasMoved(light, light + MOVED_SECONDS)).toBe(true);
  });

  it("hands over to the fraction exactly where the two bars agree", () => {
    // The crossover is derived rather than chosen: at this cost the fraction is two seconds, and
    // above it the fraction is the higher bar. No third constant, and nothing to keep in step.
    const crossover = MOVED_SECONDS / MOVED_FRACTION;
    expect(crossover * MOVED_FRACTION).toBe(MOVED_SECONDS);
    expect(hasMoved(crossover, crossover + MOVED_SECONDS)).toBe(true);
    expect(hasMoved(crossover * 2, crossover * 2 + MOVED_SECONDS)).toBe(false);
  });
});
