import { describe, expect, it } from "vitest";
import { ArgumentError, parseReplayArgs } from "../scripts/lib/replayArgs.js";

/* Every refusal here stops a run that would have reported success over a set of pages nobody
 * chose, which is the one outcome the replay cannot afford. They were unreachable from a test
 * while they lived at the top of the run itself. */

const parse = (...args: string[]) => parseReplayArgs(args);
const refusal = (...args: string[]): string => {
  try {
    parseReplayArgs(args);
  } catch (error) {
    if (error instanceof ArgumentError) return error.message;
    throw error;
  }
  throw new Error(`expected ${args.join(" ")} to be refused`);
};

describe("what a replay was asked for", () => {
  it("defaults to the whole site with no arguments", () => {
    expect(parse()).toEqual({
      pages: [],
      onlyChanged: false,
      recordTimings: false,
      timingsOut: undefined,
      shard: { index: 1, total: 1 },
    });
  });

  it("takes named pages", () => {
    expect(parse("wget", "curl").pages).toEqual(["wget", "curl"]);
  });

  it("reads a shard as one-based index over a total", () => {
    expect(parse("--shard=2/7").shard).toEqual({ index: 2, total: 7 });
  });

  it("reads the flags that stand alone", () => {
    expect(parse("--changed").onlyChanged).toBe(true);
    expect(parse("--record-timings").recordTimings).toBe(true);
  });

  it("reads the file a shard writes its own measurements to", () => {
    expect(parse("--timings-out=/tmp/shard.json").timingsOut).toBe("/tmp/shard.json");
  });
});

describe("what a replay refuses", () => {
  // A typo would otherwise be read as a page name, match nothing, and exit before replaying.
  it("an unknown flag, naming it", () => {
    expect(refusal("--changes")).toContain("--changes");
  });

  // An empty value is falsy, so the run would replay everything, write nothing, say nothing, and
  // leave the workflow that asked for the file reporting the whole site as a hole.
  it("--timings-out= with no filename", () => {
    expect(refusal("--timings-out=")).toContain("needs a filename");
  });

  it("a shard index outside its total", () => {
    expect(refusal("--shard=5/4")).toContain("out of range");
  });

  it("a shard that is not two numbers", () => {
    expect(refusal("--shard=half")).toContain("<index>/<total>");
  });

  // Recording a partial run overwrites the times of every page not in it.
  it("--record-timings alongside anything that makes the run partial", () => {
    for (const partial of ["--shard=1/2", "--changed", "wget"]) {
      expect(refusal("--record-timings", partial)).toContain("needs the full run");
    }
  });

  // Sharding named pages replays whichever of them the split happened to land here, and none at
  // all in the other shards, each exiting 0.
  it("--shard alongside named pages, and says to drop the shard", () => {
    const message = refusal("--shard=2/4", "wget");
    expect(message).toContain("cannot be combined with named pages");
    expect(message).toContain("wget");
  });

  it("but allows --shard with --changed, which is what CI runs", () => {
    const request = parse("--shard=2/4", "--changed");
    expect(request.onlyChanged).toBe(true);
    expect(request.shard.total).toBe(4);
  });

  it("and allows --record-timings on a full run", () => {
    expect(parse("--record-timings").recordTimings).toBe(true);
  });
});
