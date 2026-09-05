import { describe, expect, it } from "vitest";
import { RUN_PREFIX, containerFor, isAbandoned, ownerPid } from "../scripts/lib/replayContainers.js";

/* Who owns a container decides whether the sweep may remove it, and getting that wrong costs
 * either a leaked privileged container or a concurrent run's page reported as failing. Both are
 * expensive to reproduce with real containers and cheap to pin here. */

const nobodyAlive = (): boolean => false;
const everyoneAlive = (): boolean => true;

describe("naming a container", () => {
  it("carries the run's pid and the page", () => {
    expect(containerFor("wget", 4242)).toBe(`${RUN_PREFIX}4242-wget`);
  });

  it("keeps the stem a hand-started sandbox uses, so one is never swept", () => {
    expect(containerFor("wget", 1)).toMatch(/^content-sandbox-/);
    expect(ownerPid("content-sandbox-abc123")).toBeNull();
  });

  it("replaces anything Docker will not take in a name", () => {
    expect(containerFor("commands/wget", 7)).toBe(`${RUN_PREFIX}7-commands-wget`);
  });
});

describe("whether a container may be swept", () => {
  it("leaves a container alone whose owner is still running", () => {
    expect(isAbandoned(containerFor("wget", 999), everyoneAlive, 1)).toBe(false);
  });

  it("removes one whose owner has gone", () => {
    expect(isAbandoned(containerFor("wget", 999), nobodyAlive, 1)).toBe(true);
  });

  /* Nothing has been started when the sweep runs, so a container in our own name is the residue of
   * an earlier run the kernel has since given our pid to. Left in place it takes the name the next
   * page is about to ask for, and that page reports as unreplayable until someone removes it. */
  it("removes one carrying our own pid, whatever the liveness check says", () => {
    expect(isAbandoned(containerFor("wget", 1234), everyoneAlive, 1234)).toBe(true);
  });

  it("never touches a container this harness did not name", () => {
    for (const name of ["content-sandbox-manual", "some-other-container", ""]) {
      expect(isAbandoned(name, nobodyAlive, 1)).toBe(false);
    }
  });
});
