// Naming the containers a replay owns, and clearing up the ones an interrupted run left behind.
import { execFileSync } from "node:child_process";

/** Names a container after the run that owns it and the page it is replaying, so `docker ps`
 *  during a long run says what is happening, and so the sweep below can tell three things apart:
 *  a container this run owns, one another live run owns, and one nobody owns any more.
 *
 *  The `content-sandbox-` stem is required by `scripts/replay/sandbox.sh`, so a sandbox somebody
 *  started by hand to write a page shares it. That is why the run marker comes after the stem
 *  rather than replacing it: a hand-started sandbox never matches, and is never swept. */
export const RUN_PREFIX = "content-sandbox-replay";

export const containerFor = (page: string, pid: number = process.pid): string =>
  `${RUN_PREFIX}${pid}-${page.replace(/[^a-z0-9-]/gi, "-")}`;

/** The pid out of a container this harness named, or null if the name is not one of ours. */
export function ownerPid(name: string): number | null {
  const owner = new RegExp(`^${RUN_PREFIX}(\\d+)-`).exec(name);
  return owner?.[1] === undefined ? null : Number(owner[1]);
}

/** Whether a container may be removed: nobody is still using it.
 *
 *  Ownership is decided by the pid in the name, so a second replay running at the same time keeps
 *  its containers. Nothing here needs two replays to work, but silently destroying another one's
 *  sandboxes mid-run would report as a page failing.
 *
 *  A pid the kernel has since handed to some unrelated process therefore reads as a live owner,
 *  and that container survives the sweep. Telling that apart from a concurrent replay would take
 *  the owner's start time as well, which is not portable. It costs a leaked container until the
 *  next reboot, and it cannot cost a *result*: the one pid this run names containers with is its
 *  own, so the only leftover that can ever collide with a name we are about to claim is one
 *  carrying our pid, which is swept whatever `alive` says about it.
 *
 *  `alive` and `self` are parameters so `test/replayContainers.test.ts` can hold that rule without
 *  starting a container or borrowing a pid.
 */
export function isAbandoned(
  name: string,
  alive: (pid: number) => boolean,
  self: number = process.pid,
): boolean {
  const pid = ownerPid(name);
  if (pid === null) return false;
  return pid === self || !alive(pid);
}

/** Whether a process is still running, for `isAbandoned`. Signal 0 checks without delivering. */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Removes containers left behind by a replay that is no longer running.
 *
 *  Tearing down after each page covers the ordinary paths, and the run's signal handlers cover an
 *  interrupt between pages. Neither covers an interrupt that arrives *mid-example*: the loop is
 *  blocked inside a synchronous `docker exec`, a JavaScript signal handler cannot run until that
 *  returns, and whatever kills the process first wins. A privileged container then outlives its
 *  run, and the next thing to notice is usually a port still being held. Sweeping at the start
 *  rather than trying harder at the end also covers a crash and a `kill -9`, which no handler can.
 *
 *  Nothing has been started when this runs, so a container in our own name is the residue of an
 *  earlier run the kernel has since given our pid to, never one we are using. Left in place it
 *  takes the name that page is about to ask for, `docker run` exits 125, and the page reports as
 *  unreplayable for as long as the container is there. */
export function sweepAbandoned(): void {
  let abandoned: string[];
  try {
    abandoned = execFileSync(
      "docker",
      ["ps", "-a", "--filter", `name=^${RUN_PREFIX}`, "--format", "{{.Names}}"],
      { encoding: "utf-8" },
    )
      .split("\n")
      .filter((name) => isAbandoned(name, processAlive));
  } catch {
    return;
  }
  if (!abandoned.length) return;
  console.log(`removing ${abandoned.length} sandbox(es) left by an interrupted run`);
  try {
    execFileSync("docker", ["rm", "-f", ...abandoned], { stdio: "ignore" });
  } catch {
    console.error("could not remove them; `docker ps -a` will list what is left");
  }
}
