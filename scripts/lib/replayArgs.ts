// What `npm run replay` was asked to do, parsed out of argv before anything touches Docker.
//
// Separate from the run itself so the refusals below can be tested without a container. Each one
// exists because the combination it rejects would otherwise report a green run over a set of pages
// nobody chose, and that is the failure this harness cannot afford to have.
import { type Shard, ShardError, parseShard } from "./replayShard.js";

/** The run was asked for something it will not do. Carries the whole message, including the
 *  second line telling the caller what to do instead, since a refusal that does not say how to get
 *  what you wanted is a refusal you argue with. */
export class ArgumentError extends Error {}

/** Flags that stand alone, and the prefixes of the ones that carry a value. Listed rather than
 *  matched loosely so an unknown flag is refused: a typo like `--changes` would otherwise be read
 *  as a page name, match nothing, and exit before replaying anything. */
const FLAGS = ["--changed", "--record-timings"] as const;
const VALUE_FLAGS = ["--shard=", "--timings-out="] as const;

export interface ReplayRequest {
  /** Pages named on the command line. Empty means every page, subject to `onlyChanged`. */
  pages: string[];
  onlyChanged: boolean;
  /** Rewrite `scripts/replay-timings.json` from this run. Only ever a full run. */
  recordTimings: boolean;
  /** Where a shard leaves its own measurements for something else to merge, which is how CI records
   *  timings without any shard being allowed to write the file every shard reads. Unlike
   *  `recordTimings` this makes no claim to be complete, so it carries no restriction: whoever
   *  merges the parts is the one that can see whether the whole site is covered. */
  timingsOut?: string | undefined;
  shard: Shard;
}

export function parseReplayArgs(args: string[]): ReplayRequest {
  const unknown = args.filter(
    (arg) =>
      arg.startsWith("-") && !FLAGS.includes(arg as never) && !VALUE_FLAGS.some((f) => arg.startsWith(f)),
  );
  if (unknown.length) {
    throw new ArgumentError(
      `replay: unexpected argument ${unknown[0]} (accepts ${FLAGS.join(", ")}, --shard=<i>/<n>, --timings-out=<file>)`,
    );
  }

  const valueOf = (flag: string): string | undefined =>
    args.find((arg) => arg.startsWith(flag))?.slice(flag.length);

  const onlyChanged = args.includes("--changed");
  const recordTimings = args.includes("--record-timings");
  const pages = args.filter((arg) => !arg.startsWith("-"));

  // Refused rather than ignored. An empty value is falsy, so the run would replay every page, write
  // nothing, say nothing, and leave the workflow that asked for the file to report the whole site
  // as a hole several steps later.
  const timingsOut = valueOf("--timings-out=");
  if (timingsOut === "") {
    throw new ArgumentError("replay: --timings-out= needs a filename to write the measurements to");
  }

  let shard: Shard = { index: 1, total: 1 };
  const shardFlag = valueOf("--shard=");
  if (shardFlag !== undefined) {
    try {
      shard = parseShard(shardFlag);
    } catch (error) {
      throw new ArgumentError(`replay: ${(error as ShardError).message}`);
    }
  }

  // Recording a partial run would overwrite the times of every page not in it. The file balances
  // the shards, so a shard writing it is also the case where the damage is least visible.
  if (recordTimings && (shard.total > 1 || onlyChanged || pages.length > 0)) {
    throw new ArgumentError(
      "replay: --record-timings needs the full run, so it cannot be combined with\n  --shard, --changed, or named pages.",
    );
  }

  // Naming pages and then sharding them replays whichever of them the split happened to put in this
  // shard, and none at all in the other shards, each exiting 0. `--changed` is the combination that
  // is meant: it selects a set, and CI shards that set across its runners.
  if (shard.total > 1 && pages.length > 0) {
    throw new ArgumentError(
      `replay: --shard splits a whole run, so it cannot be combined with named pages.\n  Drop --shard to replay ${pages.join(", ")} directly.`,
    );
  }

  return { pages, onlyChanged, recordTimings, timingsOut, shard };
}
