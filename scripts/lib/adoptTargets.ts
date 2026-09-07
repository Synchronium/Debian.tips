// Choosing which of a page's examples have their documented output replaced by a fresh capture,
// for scripts/authoring/adopt-real-output.ts.
//
// Adopting rewrites what a page claims a command printed, so the selection is kept apart from
// the capturing: which examples are in play, which of those the caller asked for, and which
// requested titles matched nothing are all decidable without a container, and are the part worth
// checking. Two properties carry the risk, and both are asserted in test/adoptTargets.test.ts:
// titles match whole rather than by prefix, and every target keeps the index it will be looked
// up by once the captures come back.

/** The stated intent to adopt every adoptable example, rather than a title. */
export const ADOPT_ALL = "--all";

/** All the selection reads. Generic over the rest so the caller keeps its own richer example
 *  type, which it needs afterwards to write the `volatile:` note. */
export interface TitledExample {
  title: string;
}

/** An example to rewrite, carrying its position in `adoptable`. */
export interface AdoptTarget<T extends TitledExample> {
  example: T;
  /** Index into `adoptable`, which is the key its capture arrives under. */
  index: number;
}

export interface AdoptSelection<T extends TitledExample> {
  /** Every example eligible to be adopted, in the order their code is captured in. Captures are
   *  keyed by position in this list, so it is also what the indices in `targets` refer to. */
  adoptable: T[];
  /** Those the caller asked for. A subset of `adoptable`, in the same order. */
  targets: AdoptTarget<T>[];
  /** Requested titles matching no adoptable example. Non-empty means the caller must stop rather
   *  than adopt the rest: a mistyped title would otherwise be reported as a quiet no-op, and the
   *  example the caller meant to fix would stay wrong. */
  missing: string[];
}

/** Works out what to adopt.
 *
 *  `withOutput` is every example on the page documenting an `output:` block, in file order.
 *  `skipTitles` are the ones exempted in `scripts/fixtures/<command>.skip`, which name examples
 *  the replay cannot run at all: capturing one would record the failure to run it.
 *
 *  Titles are compared whole. Matching by prefix would let "Find symlinks" claim the block
 *  belonging to "Find symlinks that point to a regular file" and write one example's output into
 *  the other's, which the file itself gives no way to notice afterwards. */
export function selectAdoptTargets<T extends TitledExample>(
  withOutput: readonly T[],
  skipTitles: ReadonlySet<string>,
  titles: readonly string[],
): AdoptSelection<T> {
  const adoptable = withOutput.filter((example) => !skipTitles.has(example.title));

  const wantAll = titles[0] === ADOPT_ALL;
  const targets = adoptable
    .map((example, index) => ({ example, index }))
    .filter(({ example }) => wantAll || titles.includes(example.title));

  // Only meaningful for a named run: `--all` asks for whatever is there, so it cannot miss.
  // A title naming a skipped example counts as missing rather than being ignored, since the
  // caller asked for something this tool will not do and should hear so.
  const missing = wantAll
    ? []
    : titles.filter((title) => !adoptable.some((example) => example.title === title));

  return { adoptable, targets, missing };
}
