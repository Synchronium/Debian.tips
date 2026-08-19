import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { shellQuote } from "../scripts/lib/sandbox.js";

/* `shellQuote` is the single point where content becomes a shell command: every example's code
 * goes through it on its way into `bash -c` inside the sandbox. A quoting bug here does not
 * announce itself — the command runs, prints something else, and the replay reports a mismatch
 * on a page that was correct. Checked against a real shell rather than against an expected
 * string, because what matters is what bash does with it. */

/** What bash actually sees as a single argument after the quoting. */
function roundTrip(value: string): string {
  return execFileSync("bash", ["-c", `printf %s ${shellQuote(value)}`], { encoding: "utf-8" });
}

describe("shellQuote", () => {
  const cases: [name: string, value: string][] = [
    ["a plain command", "wc -l report.txt"],
    ["a single quote", "awk '{ print $1 }' file"],
    ["adjacent single quotes", "echo ''"],
    ["a double quote", 'grep "needle" haystack'],
    ["a dollar sign", "echo $HOME $(whoami) `id`"],
    ["a backslash", String.raw`sed "s/\r/x/" crlf.txt`],
    ["a newline", 'for f in *.txt; do\n  echo "$f"\ndone'],
    ["a semicolon and an ampersand", "rm -rf /tmp/x; echo owned & true"],
    ["a percent and a brace", "printf '%s\\n' {a,b}"],
    ["unicode", "echo ␍ — ok"],
  ];

  for (const [name, value] of cases) {
    it(`survives ${name}`, () => {
      expect(roundTrip(value)).toBe(value);
    });
  }

  it("keeps a command inert rather than letting it run", () => {
    // The whole point: an example's text is data, and must never be interpreted by the shell
    // that carries it.
    expect(roundTrip("$(touch /tmp/should-not-exist)")).toBe("$(touch /tmp/should-not-exist)");
  });
});
