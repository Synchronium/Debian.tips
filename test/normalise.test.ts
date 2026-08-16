import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs shared with scripts/, no types
import { MASK_TOKENS, normalise, stripArtifacts } from "../scripts/lib/normalise.mjs";

/* This module decides what every command page is allowed to claim a command printed:
 * `adopt-real-output.mjs` writes `stripArtifacts` output straight onto a page, and
 * `verify-examples.mjs` compares `normalise` of the page against `normalise` of a fresh
 * run. Because both sides go through the same function, a bug here is invisible to the
 * replay — it corrupts the page and then certifies the corruption. Every case below is a
 * regression that actually shipped, or an invariant that keeps one from shipping. */

describe("stripArtifacts — what gets written onto a page", () => {
  it("keeps the first line's leading padding", () => {
    // `wc` and `uniq -c` right-align their counts. A `.trim()` here removed the padding
    // from the first line only, leaving crooked columns on the page while the replay
    // still reported an exact match, because it trimmed the real output the same way.
    const wc = "      3      12      70 report.txt\n     40      80     400 total";
    expect(stripArtifacts(wc)).toBe(wc);
  });

  it("keeps a blank line that follows a line with trailing whitespace", () => {
    // `\s+$` with the m flag reaches across the line ending, because `\s` matches `\n`.
    expect(stripArtifacts("line one  \n\nline three\n")).toBe("line one\n\nline three");
  });

  it("removes trailing spaces, and leading and trailing blank lines", () => {
    expect(stripArtifacts("\n\n  indented  \ntail\t\n\n")).toBe("  indented\ntail");
  });

  it("drops the carriage returns HTTP puts at the end of every header line", () => {
    // `curl -i` prints the response exactly as it arrives, CRLF and all, including the
    // lone CR on the blank line that separates headers from body.
    const response = "HTTP/1.0 200 OK\r\nContent-Length: 120\r\n\r\n";
    expect(stripArtifacts(response)).toBe("HTTP/1.0 200 OK\nContent-Length: 120");
  });

  it("leaves one blank line where wget's bar was, not two", () => {
    // wget puts a blank line either side of the bar. Removing the bar and keeping both
    // leaves a two-line hole that no reader ever sees.
    const report = [
      "Saving to: 'page.html'",
      "",
      "     0K                                                       100% 29.2M=0s",
      "",
      "2026-08-16 09:28:19 (29.2 MB/s) - 'page.html' saved [120/120]",
    ].join("\n");
    expect(stripArtifacts(report)).toBe(
      "Saving to: 'page.html'\n\n2026-08-16 09:28:19 (29.2 MB/s) - 'page.html' saved [120/120]",
    );
  });

  it("strips a wget progress bar without touching the lines around it", () => {
    // The bar is redrawn with carriage returns and sized to the terminal, so no frame is
    // worth publishing. An earlier version reached across newlines to find the `%` and
    // swallowed every real line in between.
    const report = [
      "Saving to: 'page.html'",
      "     0K .......... ..........  50% 1.2M 0s",
      "    64K                       100% 5.0M=0.1s",
      "keep this line",
      "and 100% of this one",
      "tail line",
    ].join("\n");
    expect(stripArtifacts(report)).toBe(
      "Saving to: 'page.html'\nkeep this line\nand 100% of this one\ntail line",
    );
  });

  it("strips curl's progress meter", () => {
    const meter = [
      "  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current",
      "                                 Dload  Upload   Total   Spent    Left  Speed",
      "100   120  100   120    0     0  12000      0 --:--:-- --:--:-- --:--:-- 13000",
      "<!doctype html>",
    ].join("\n");
    expect(stripArtifacts(meter)).toBe("<!doctype html>");
  });

  it("drops bash's line numbers, which an interactive shell never prints", () => {
    expect(stripArtifacts("bash: line 12: frobnicate: command not found")).toBe(
      "bash: frobnicate: command not found",
    );
  });

  it("never introduces a mask token", () => {
    // Masks belong to comparison only. This is the invariant that keeps <TIMESTAMP> and
    // <VOLATILE> off the published pages, where they read as broken placeholders.
    const real = [
      "--2026-08-15 21:37:59--  http://localhost:8080/page.html",
      "2026-08-15 21:37:59 (49.0 MB/s) - 'page.html' saved [120/120]",
      "date: Sat, 15 Aug 2026 22:04:37 GMT",
      "Total bytes written: 30720 (30KiB, 305MiB/s)",
    ].join("\n");
    const written = stripArtifacts(real);
    for (const token of MASK_TOKENS) expect(written).not.toContain(token);
    expect(written).toBe(real);
  });
});

describe("normalise — what gets compared", () => {
  const changes = (before: string, after: string) => {
    expect(normalise(before)).toBe(normalise(after));
  };
  const differs = (before: string, after: string) => {
    expect(normalise(before)).not.toBe(normalise(after));
  };

  it("masks the mtime in a diff header but not the diff body", () => {
    changes(
      "--- nginx-old.conf\t2026-08-14 09:15:00.000000000 +0000",
      "--- nginx-old.conf\t2026-08-15 10:09:33.149381006 +0000",
    );
    differs("-  worker_connections 768;", "-  worker_connections 1024;");
  });

  it("masks the mtime column of tar -tvf", () => {
    changes(
      "-rw-r--r-- user/user       120 2026-07-05 15:35 site/index.html",
      "-rw-r--r-- user/user       120 2026-08-16 09:01 site/index.html",
    );
    // The size is not a clock value and must still be held exactly.
    differs(
      "-rw-r--r-- user/user       120 2026-07-05 15:35 site/index.html",
      "-rw-r--r-- user/user       121 2026-07-05 15:35 site/index.html",
    );
  });

  it("masks wget's own report lines", () => {
    changes(
      "--2026-08-15 21:37:59--  http://localhost:8080/page.html",
      "--2026-08-16 07:00:00--  http://localhost:8080/page.html",
    );
    changes(
      "2026-08-15 21:37:59 (49.0 MB/s) - 'page.html' saved [120/120]",
      "2026-08-16 07:00:00 (3.32 GB/s) - 'page.html' saved [120/120]",
    );
    changes(
      "2026-08-15 21:38:02 ERROR 500: Internal Server Error.",
      "2026-08-16 07:00:00 ERROR 500: Internal Server Error.",
    );
    // The byte counts in the same line are real and stay compared.
    differs(
      "2026-08-15 21:37:59 (49.0 MB/s) - 'page.html' saved [120/120]",
      "2026-08-15 21:37:59 (49.0 MB/s) - 'page.html' saved [121/121]",
    );
  });

  it("leaves a date that is part of file content alone", () => {
    // The whole reason every mask is anchored: an unanchored `\d{4}-\d{2}-\d{2} \d{2}:\d{2}`
    // also matches a date inside the sample data a page shows, so the file could drift
    // and the replay would never notice.
    differs("2026-08-14 09:15:00 backup completed", "2026-08-15 10:09:33 backup completed");
    differs("last run: 2026-07-05 15:35", "last run: 2026-08-16 09:01");
  });

  it("leaves an ls -l long-iso column alone, because the server pins it", () => {
    differs("2026-07-05 15:35 a.html", "2026-08-16 09:01 a.html");
  });

  it("holds every response header exactly, including the date", () => {
    // The local test server pins its own Date and Last-Modified, so a page can print a
    // response verbatim. The mask that used to blank these existed for one example that
    // fetched headers from a real host through Cloudflare.
    differs("Date: Sun, 05 Jul 2026 15:40:00 GMT", "Date: Mon, 06 Jul 2026 15:40:00 GMT");
    differs("content-length: 120", "content-length: 121");
    differs("last-modified: Sun, 05 Jul 2026 15:35:00 GMT", "last-modified: Mon, 06 Jul 2026 15:35:00 GMT");
  });

  it("masks rates and elapsed times", () => {
    changes(
      "Total bytes written: 30720 (30KiB, 305MiB/s)",
      "Total bytes written: 30720 (30KiB, 42MiB/s)",
    );
    differs(
      "Total bytes written: 30720 (30KiB, 305MiB/s)",
      "Total bytes written: 40960 (40KiB, 305MiB/s)",
    );
    changes(
      "curl: (28) Operation timed out after 2001 milliseconds with 0 bytes received",
      "curl: (28) Operation timed out after 2004 milliseconds with 0 bytes received",
    );
  });

  it("is idempotent, so an already-masked page can never be re-masked into a match", () => {
    const once = normalise("--2026-08-15 21:37:59--  http://localhost:8080/page.html");
    expect(normalise(once)).toBe(once);
  });
});
