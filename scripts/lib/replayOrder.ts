// The order pages are replayed in.
//
// Every page shares one sandbox, so the order is part of what is tested: a page that only passes
// because of what ran before it is a page that is true by luck, and a single fixed order samples
// exactly one of the possible orderings. ADR-0002 records why the sandbox is shared and what
// sampling the rest of the space has already caught.
//
// A seed is always resolved and always printed, so nothing here is ever irreproducible: a shuffled
// run that fails names the exact command that fails the same way again.

/** The orderings a run can be asked for. The values are also the CLI spelling, so `--order=`
 *  accepts exactly what is listed here and the error text is derived rather than restated. */
export const ORDER_MODE = {
  /** Sorted by slug. The default, and the stable reference — when a shuffled run fails and this
   *  one passes, the difference is the ordering rather than a regression. */
  alpha: "alpha",
  /** The cheapest single alternative permutation: deterministic, needs no seed, and about as far
   *  from `alpha` as one ordering gets. */
  reverse: "reverse",
  /** Seeded Fisher-Yates. The seed is always resolved and always printed. */
  random: "random",
} as const;
export type OrderMode = (typeof ORDER_MODE)[keyof typeof ORDER_MODE];

export interface ReplayOrder {
  mode: OrderMode;
  /** Only meaningful for `random`. Any string: CI passes the commit SHA, so the permutation
   *  varies from commit to commit while a re-run of the same commit rolls the same dice. */
  seed: string;
}

export class OrderError extends Error {}

/** Parses `--order=alpha`, `--order=reverse`, `--order=random`, `--order=random:<seed>`.
 *
 *  A bare `random` invents a seed rather than leaving one unset, so there is no path through this
 *  file that produces an ordering nobody can reproduce. */
export function parseOrder(value: string): ReplayOrder {
  const [mode, ...rest] = value.split(":");
  const seed = rest.join(":");

  if (mode === ORDER_MODE.alpha || mode === ORDER_MODE.reverse) {
    if (seed) throw new OrderError(`--order=${mode} takes no seed`);
    return { mode, seed: "" };
  }
  if (mode === ORDER_MODE.random) {
    return { mode, seed: seed || Math.random().toString(36).slice(2, 10) };
  }
  throw new OrderError(
    `unknown order "${value}" (expected ${Object.values(ORDER_MODE).join(", ")}, or ${ORDER_MODE.random}:<seed>)`,
  );
}

/** How the chosen order is written back to a reader — and, for `random`, the argument that
 *  reproduces it exactly. */
export function describeOrder(order: ReplayOrder): string {
  return order.mode === ORDER_MODE.random ? `${ORDER_MODE.random}:${order.seed}` : order.mode;
}

/** FNV-1a over the seed string, so a git SHA and a hand-typed word are both usable. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, and — the only property that matters here — identical everywhere.
 *  `Math.random()` cannot be used even with a seed, because nothing in the language says two
 *  engines produce the same sequence from the same state, and a seed that reproduces only on the
 *  machine that generated it is not a seed. */
function mulberry32(state: number): () => number {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns the pages in the requested order. Input is sorted first, so the result depends only on
 *  the set of pages and the order — never on the order the caller happened to collect them in,
 *  which comes from `readdirSync` and is a filesystem detail. */
export function orderPages(names: string[], order: ReplayOrder): string[] {
  const sorted = [...names].sort();
  if (order.mode === ORDER_MODE.alpha) return sorted;
  if (order.mode === ORDER_MODE.reverse) return sorted.reverse();

  // Fisher-Yates, back to front.
  const random = mulberry32(hashSeed(order.seed));
  for (let index = sorted.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [sorted[index], sorted[swap]] = [sorted[swap]!, sorted[index]!];
  }
  return sorted;
}
