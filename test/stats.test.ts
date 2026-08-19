import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../src/content/loader.js";
import { fillStats, verificationStats, type VerificationStats } from "../src/content/stats.js";

/* Every number on /about/ comes from here, on a page whose whole argument is that its numbers
 * are counted rather than typed. Two of them were wrong and nothing could see it: outputs on a
 * command page with no setup script were counted as "re-run on every push" when the replay skips
 * that page entirely, and exemptions were counted by reading every line of every .skip file in
 * the repository — so an entry naming an example that no longer existed silently reduced the
 * figure the site advertises. */

const FIXTURE_CONTENT = join(import.meta.dirname, "fixtures", "content");
const FIXTURE_HARNESS = join(import.meta.dirname, "fixtures", "harness");
const NO_HARNESS = join(import.meta.dirname, "fixtures", "harness-none");

async function statsFor(fixtureDir: string): Promise<VerificationStats> {
  const { pages } = await loadContent(FIXTURE_CONTENT);
  return verificationStats(pages, FIXTURE_CONTENT, fixtureDir);
}

describe("verificationStats", () => {
  it("counts the fixture tree exactly", async () => {
    // greet: 4 examples, all with output, 1 exempted in greet.skip, 1 fixture block, 1 volatile.
    // lesson-one: one bash/output pair, and a setup script, so it replays as prose.
    expect(await statsFor(FIXTURE_HARNESS)).toEqual({
      pages: 3,
      commandPages: 1,
      unreplayedCommandPages: 0,
      examples: 4,
      outputs: 4,
      replayed: 4, // 4 documented - 1 exempt + 1 prose
      volatile: 1,
      fixtures: 1,
      exemptions: 1,
      prosePages: 1,
      proseOutputs: 1,
    });
  });

  it("counts nothing as replayed on a page with no setup script", async () => {
    // The page still exists and still has four documented outputs; what it does not have is
    // anything re-running them, which is the only claim /about/ makes.
    const stats = await statsFor(NO_HARNESS);
    expect(stats.commandPages).toBe(0);
    expect(stats.unreplayedCommandPages).toBe(1);
    expect(stats.outputs).toBe(0);
    expect(stats.replayed).toBe(0);
    expect(stats.prosePages).toBe(0);
  });
});

describe("fillStats", () => {
  const stats: VerificationStats = {
    pages: 3,
    commandPages: 1,
    unreplayedCommandPages: 0,
    examples: 4,
    outputs: 4,
    replayed: 4,
    volatile: 1,
    fixtures: 1,
    exemptions: 1,
    prosePages: 1,
    proseOutputs: 1,
  };

  it("substitutes every token it knows", () => {
    expect(fillStats("{{replayed}} of {{outputs}}", stats)).toBe("4 of 4");
  });

  it("refuses a token it has no value for", () => {
    expect(() => fillStats("{{nonsense}}", stats)).toThrow(/unknown statistic \{\{nonsense\}\}/);
  });

  it("refuses a counted zero, which always means the counting broke", () => {
    expect(() => fillStats("{{replayed}}", { ...stats, replayed: 0 })).toThrow(/counted zero/);
  });

  it("allows zero for the one figure where zero is the good answer", () => {
    // "0 command pages nothing re-runs" is the state the site wants to be in, and saying so is
    // the point of the figure.
    expect(fillStats("{{unreplayedCommandPages}}", stats)).toBe("0");
  });
});
