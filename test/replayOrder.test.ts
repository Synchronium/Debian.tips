import { describe, expect, it } from "vitest";
import { ORDER_MODE, OrderError, describeOrder, orderPages, parseOrder } from "../scripts/lib/replayOrder.js";

/* The replay's ordering. Two properties carry the whole feature and neither is visible from a
 * green run: that a seed reproduces its permutation exactly, and that every page is still in it.
 * A shuffle that dropped a page would report a smaller batch as a clean one. */

const PAGES = ["apt", "awk", "cowsay", "dpkg", "grep", "jq", "sed", "tar", "wc", "wget"];

describe("parsing --order", () => {
  // The argument strings stay literal on the input side: what these pin is that the text someone
  // types after `--order=` maps to the mode, and going through ORDER_MODE on both sides would
  // keep passing after a rename that had changed the CLI out from under every caller.
  it("accepts the three modes", () => {
    expect(parseOrder("alpha")).toEqual({ mode: ORDER_MODE.alpha, seed: "" });
    expect(parseOrder("reverse")).toEqual({ mode: ORDER_MODE.reverse, seed: "" });
    expect(parseOrder("random:abc123")).toEqual({ mode: ORDER_MODE.random, seed: "abc123" });
  });

  it("invents a seed for a bare random, rather than leaving the run irreproducible", () => {
    const order = parseOrder("random");
    expect(order.mode).toBe(ORDER_MODE.random);
    expect(order.seed).not.toBe("");
    expect(describeOrder(order)).toBe(`random:${order.seed}`);
  });

  it("keeps a seed containing colons whole", () => {
    // A caller passing something structured — a branch name, a tag — should not have it
    // truncated into a different seed that still looks valid.
    expect(parseOrder("random:refs/heads/main:2").seed).toBe("refs/heads/main:2");
  });

  it("rejects a mode it does not know, and a seed on one that takes none", () => {
    expect(() => parseOrder("shuffle")).toThrow(OrderError);
    expect(() => parseOrder("alpha:7")).toThrow(OrderError);
  });
});

describe("ordering pages", () => {
  it("sorts, and reverses that sort", () => {
    expect(orderPages(PAGES, { mode: ORDER_MODE.alpha, seed: "" })).toEqual([...PAGES].sort());
    expect(orderPages(PAGES, { mode: ORDER_MODE.reverse, seed: "" })).toEqual([...PAGES].sort().reverse());
  });

  it("does not depend on the order the caller collected them in", () => {
    // The caller's input comes from readdirSync, which is a filesystem detail — two checkouts of
    // the same commit could hand these over in different orders and must still replay identically.
    const shuffledInput = [...PAGES].reverse();
    for (const mode of Object.values(ORDER_MODE)) {
      const order = { mode, seed: "fixed" };
      expect(orderPages(shuffledInput, order)).toEqual(orderPages(PAGES, order));
    }
  });

  it("gives the same permutation for the same seed", () => {
    const once = orderPages(PAGES, { mode: ORDER_MODE.random, seed: "6c4f2e1" });
    const again = orderPages(PAGES, { mode: ORDER_MODE.random, seed: "6c4f2e1" });
    expect(again).toEqual(once);
  });

  it("gives a different permutation for a different seed", () => {
    const a = orderPages(PAGES, { mode: ORDER_MODE.random, seed: "seed-one" });
    const b = orderPages(PAGES, { mode: ORDER_MODE.random, seed: "seed-two" });
    expect(b).not.toEqual(a);
  });

  it("actually shuffles rather than returning the sorted list", () => {
    // A broken PRNG returning 0 every time leaves Fisher-Yates a no-op, which looks like a
    // working shuffle from every angle except this one.
    const sorted = [...PAGES].sort();
    const seeds = ["a", "b", "c", "d", "e"];
    expect(
      seeds.some((seed) => !arraysEqual(orderPages(PAGES, { mode: ORDER_MODE.random, seed }), sorted)),
    ).toBe(true);
  });

  it("keeps every page, exactly once, whatever the order", () => {
    for (const mode of Object.values(ORDER_MODE)) {
      const result = orderPages(PAGES, { mode, seed: "whatever" });
      expect([...result].sort()).toEqual([...PAGES].sort());
      expect(new Set(result).size).toBe(PAGES.length);
    }
  });

  it("leaves the caller's array alone", () => {
    const input = [...PAGES];
    orderPages(input, { mode: ORDER_MODE.random, seed: "x" });
    expect(input).toEqual(PAGES);
  });

  it("handles the degenerate sizes a --changed run produces", () => {
    for (const mode of Object.values(ORDER_MODE)) {
      expect(orderPages([], { mode, seed: "x" })).toEqual([]);
      expect(orderPages(["wc"], { mode, seed: "x" })).toEqual(["wc"]);
    }
  });
});

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
