import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_DIR, commandsDir } from "../src/paths.js";
import { readExamplesFile } from "../scripts/lib/examplesFile.js";

/* `ls -l` prints a time of day for a file modified within the last six months, and the year
 * instead for anything older, so a listing reading `Jun  1 09:00` today reads `Jun  1  2026` once
 * that date ages past the boundary. Every page showing a listing takes its timestamps from a
 * `touch -d` in a setup script, so those dates decide when it happens, and it happens to every
 * page sharing a date on the same day.
 *
 * Neither comparison survives the flip. The exact one sees a different string, and `compare:
 * shape` masks the month name and the digits but not the colon, so `M 0 0:0` and `M 0 0` still
 * differ. That leaves the replay as the backstop rather than the warning, and it reports on the
 * day the site starts lying rather than before.
 *
 * This is the warning. A date is safe while it sits well inside the window, and safe again once
 * it is well past it, because a listing showing a year keeps showing that year. What fails here is
 * the month either side of the boundary, which puts the failure roughly a month ahead of the
 * break. The margin costs a new fixture the right to pick a date in that band, which is no loss:
 * it is the one range where the captured output would be true only briefly. */
const MS_PER_DAY = 86_400_000;
/** The Gregorian year coreutils halves to make this decision, and a twelfth of it for the margin
 *  either side. Written as one figure so the two thresholds cannot drift apart. */
const YEAR_DAYS = 365.2425;
const BOUNDARY = { flip: YEAR_DAYS / 2, margin: YEAR_DAYS / 12 } as const;

/** A literal date some shell sets on a file, and how old it is now. */
interface Timestamp {
  where: string;
  date: string;
  ageDays: number;
}

const TOUCHES = /\btouch\b/;
const DASH_D = /-d\s+(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
/** Only `touch -t`'s full `YYYYMMDDhhmm` form. Anchoring on the digits rather than on whatever
 *  follows `-t` is what keeps `xargs -t` and `sort -t` off this list when they share a line with a
 *  `touch`, which they do. */
const DASH_T = /-t\s+(\d{4})(\d{2})(\d{2})\d{4}(?:\.\d{2})?\b/g;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})\b/;

/** Every fixed date a chunk of shell stamps onto a file.
 *
 *  A date built by a substitution is skipped: `touch -d "$(date -d '3 days ago' …)"` is the same
 *  age on every run, so it cannot drift across the boundary and is the safe way to want a recent
 *  file. Anything `-d` is handed that is not an absolute date is skipped for the same reason, which
 *  is also what keeps a `date -d '3 days ago'` inside the substitution off the list. */
function timestampsIn(text: string, where: (line: number) => string, now: number): Timestamp[] {
  const found: Timestamp[] = [];
  const add = (line: number, year: string, month: string, day: string): void => {
    // Midday UTC, so the age comes out the same wherever the gate runs and neither threshold
    // sits within a rounding error of a timezone.
    const when = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
    found.push({
      where: where(line),
      date: `${year}-${month}-${day}`,
      ageDays: (now - when) / MS_PER_DAY,
    });
  };

  for (const [index, line] of text.split("\n").entries()) {
    if (!TOUCHES.test(line)) continue;
    for (const match of line.matchAll(DASH_D)) {
      const value = match[1] ?? match[2] ?? match[3] ?? "";
      if (value.includes("$")) continue;
      const iso = ISO_DAY.exec(value);
      if (iso !== null) add(index + 1, iso[1]!, iso[2]!, iso[3]!);
    }
    for (const match of line.matchAll(DASH_T)) add(index + 1, match[1]!, match[2]!, match[3]!);
  }
  return found;
}

/** The dates every setup script stamps. These are the ones that reach a page: a listing on any
 *  page showing a time of day is showing one of them. */
function fixtureTimestamps(now: number): Timestamp[] {
  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".sh"))
    .flatMap((name) =>
      timestampsIn(
        readFileSync(join(FIXTURE_DIR, name), "utf-8"),
        (line) => `scripts/fixtures/${name}:${line}`,
        now,
      ),
    );
}

/** An `ls`-style time of day, which is the claim that ages out. The month and day alone are not
 *  enough, because the year form carries those too and is stable. Excluding a following colon is
 *  what keeps a syslog or `journalctl` line, which prints seconds, off the list. */
const LISTED_TIME = /\b[A-Z][a-z]{2} {1,2}\d{1,2} +\d{2}:\d{2}(?!:)/;

/** The dates an example sets for itself, where that example goes on to show a listing.
 *
 *  Restricted to those, because a date is only exposed to the boundary if a page displays it in
 *  this form. An example stamping a date and reading it back with `stat` or `find` prints the
 *  whole date or no date at all, and is free to choose any. */
function exampleTimestamps(now: number): Timestamp[] {
  const found: Timestamp[] = [];
  for (const slug of readdirSync(commandsDir())) {
    for (const section of readExamplesFile(slug).sections) {
      for (const example of section.examples) {
        if (example.output === undefined || !LISTED_TIME.test(example.output)) continue;
        found.push(...timestampsIn(example.code, () => `${slug}: ${example.title}`, now));
      }
    }
  }
  return found;
}

/** The ones close enough to the boundary to be about to change form, named so a failure says
 *  which file to open. */
function drifting(stamps: Timestamp[]): string[] {
  return stamps
    .filter(({ ageDays }) => Math.abs(ageDays - BOUNDARY.flip) < BOUNDARY.margin)
    .map(({ where, date, ageDays }) => `${where}: ${date}, ${Math.round(ageDays)} days old`);
}

describe("a fixed timestamp a page displays", () => {
  const now = Date.now();
  const all = [...fixtureTimestamps(now), ...exampleTimestamps(now)];

  it("is never left drifting across the six-month boundary", () => {
    const found = drifting(all);

    // Two ways out, and which one is right is an editorial call rather than a mechanical one.
    // Move the date forward and re-capture the pages that show it, which keeps a listing looking
    // like recent work and buys another few months; or move it back beyond the boundary and
    // re-capture once, after which it shows a year and never moves again.
    expect(
      found,
      "these dates are about to change how `ls -l` prints them; `npm run replay` will start failing on the pages that show them",
    ).toEqual([]);
  });

  it("is never in the future", () => {
    // `ls` prints the year for anything more than an hour ahead, so a future date reads as an
    // old one, then becomes a recent one, then crosses the boundary like any other.
    const ahead = all.filter(({ ageDays }) => ageDays < 0).map(({ where, date }) => `${where}: ${date}`);
    expect(ahead).toEqual([]);
  });

  it("is found at all", () => {
    // The scan is pattern matching against shell, so it can quietly stop matching and leave the
    // checks above passing over an empty list. Only the setup scripts are counted: an example
    // fixing its own date and then displaying it is a thing a page may do rather than a thing any
    // page currently does, so a floor on that half would be asserting on one page's wording.
    expect(fixtureTimestamps(now).length).toBeGreaterThan(20);
  });
});

/* The check above passes today and is meant to, which says nothing about whether it can fail. The
 * clock is what moves it, so the parser and the band are exercised here against a fixed one. */
describe("the boundary itself", () => {
  const script = `
    touch -d "2026-01-01 09:00:00" src/util.js
    touch -d '2026-06-01' logs/app.log
    touch -d 2025-01-01 backups/old.tar.gz
    touch -t 202606151530 notes.txt
    touch -d "$(date -d '3 days ago' '+%Y-%m-%d') 15:53" script.sh
    touch -d "2 hours ago" recent.txt
    touch marker
  `;
  it("reads a date out of every form that fixes one, and no others", () => {
    const read = timestampsIn(script, (line) => `line ${line}`, Date.parse("2026-07-01T12:00:00Z"));
    expect(read.map(({ date }) => date)).toEqual(["2026-01-01", "2026-06-01", "2025-01-01", "2026-06-15"]);
  });

  /* One date, read on four days, which is the whole life of a fixture timestamp: written, drifting,
   * broken, and finally settled on the year form. A listing stamped 1 June stops showing a time of
   * day on about 1 December. */
  const stampedOn1June = (day: string): string[] =>
    drifting(
      timestampsIn(
        `touch -d "2026-06-01 09:00:00" logs/app.log`,
        () => "the fixture",
        Date.parse(`${day}T12:00:00Z`),
      ),
    );

  it("passes while the date is comfortably inside the window", () => {
    expect(stampedOn1June("2026-07-01")).toEqual([]);
  });

  it("fails about a month before `ls` changes its mind", () => {
    expect(stampedOn1June("2026-11-05")).toEqual(["the fixture: 2026-06-01, 157 days old"]);
  });

  it("keeps failing once the form has changed, rather than falling quiet", () => {
    // The month past the boundary is the one that matters: the pages are wrong by now, and a
    // check that had gone green again would be saying they are fine.
    expect(stampedOn1June("2026-12-05")).toEqual(["the fixture: 2026-06-01, 187 days old"]);
  });

  it("passes again only once the year form is settled", () => {
    // Beyond the far edge the listing shows a year, and a year does not move.
    expect(stampedOn1June("2027-02-05")).toEqual([]);
  });
});

/* Which output an example's dates are read for. This decides whether the example half of the scan
 * looks at a page at all, and both of its mistakes are quiet: missing a listing leaves a page
 * unguarded, and matching a log line would hold pages to a boundary their output never meets. */
describe("recognising a listed time of day", () => {
  it("matches what `ls -l` prints for a recent file", () => {
    expect(LISTED_TIME.test("-rw-r--r-- 1 user user 36 Jun  1 09:00 index.html")).toBe(true);
    expect(LISTED_TIME.test("-rw-r--r-- 1 user user 36 Jun 20 10:00 app.log")).toBe(true);
  });

  it("ignores the year form, which is what a date settles into rather than drifts out of", () => {
    expect(LISTED_TIME.test("-rw------- 1 user user 5120 May 31  2025 site.tar.gz")).toBe(false);
  });

  it("ignores a log line, which prints seconds and is not a listing", () => {
    expect(LISTED_TIME.test("Jul  5 09:14:22 deb1 sshd[812]: Accepted publickey")).toBe(false);
  });
});
