// Shared by scripts/verify-examples.mjs and scripts/adopt-real-output.mjs.
//
// Both have to agree exactly: verify compares the page against normalised output, and
// adopt writes normalised output into the page. When they drifted apart, adopt baked
// curl's progress meter into a page that verify would then reject — twice.
//
// Two kinds of thing are normalised here, and nothing else:
//
//   1. Artifacts of how the harness runs a command, which a reader typing the same
//      command interactively would never see (bash's line numbers, curl's progress
//      meter, ssh's pseudo-terminal warning).
//   2. Values that no fixture can pin because they come from the clock, the machine, or
//      the network (timestamps, transfer rates, HTTP date and cache headers).
//
// Anything else must match byte for byte. Adding to this list weakens every page, so
// prefer changing the example to be deterministic where that is possible at all.

/** File mtimes in `diff -u`/`-c` headers, `ls -l`-style stamps, and `tar -tvf`'s column. */
const timestamps = (s) =>
  s
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)? [+-]\d{4}/g, "<TIMESTAMP>")
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} +\d+ \d{2}:\d{2}:\d{2} \d{4}\b/g, "<TIMESTAMP>")
    // Examples that archive a file they just created can only ever stamp it "now".
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/g, "<TIMESTAMP>");

/** `tar --totals` prints a transfer rate, and curl reports how long it waited before a
 *  timeout fired: both are properties of the machine, not of the command. */
const rates = (s) =>
  s
    .replace(/, \d+(\.\d+)?[KMG]iB\/s\)/g, ", <RATE>)")
    .replace(/after \d+ milliseconds/g, "after <N> milliseconds");

/** Response headers that depend on when the request happened, or which cache answered. */
const httpHeaders = (s) =>
  s.replace(
    /^(date|last-modified|expires|age|cf-ray|cf-cache-status|report-to|nel|alt-svc|x-amzn-trace-id): .*$/gim,
    "$1: <VOLATILE>",
  );

/** curl shows a progress meter whenever its output is not a terminal — here, always. */
const curlProgress = (s) =>
  s
    .replace(/^\s*% Total\s+% Received.*$\n?/gm, "")
    .replace(/^\s*Dload\s+Upload.*$\n?/gm, "")
    // Successive updates are separated by carriage returns, so the whole meter arrives as
    // one physical line. Matching on "--:--:--" rather than the column layout keeps this
    // working whatever suffixes the sizes and rates pick up (120, 163k, 1.2M).
    .replace(/^[^\n]*--:--:--[^\n]*$\n?/gm, "");

/** `bash -c` numbers its diagnostics; an interactive shell does not. ssh warns about the
 *  missing terminal for the same reason. */
const shellNoise = (s) =>
  s
    .replace(/^bash: line \d+: /gm, "bash: ")
    .replace(/^Pseudo-terminal will not be allocated because stdin is not a terminal\.\n/gm, "");

export function normalise(text) {
  const trimmed = text.replace(/\s+$/gm, "").replace(/\n+$/, "").trim();
  return rates(curlProgress(shellNoise(httpHeaders(timestamps(trimmed)))));
}
