import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copyPublic, writeHashedCss } from "../src/assets.js";
import { FONT_FILE } from "../src/paths.js";

/* The stylesheet and the static scripts are minified with a source map beside them. None of it
 * is visible in the rendered HTML (the page links a hashed filename either way) so a break
 * here ships an unreadable stylesheet with no way back to the source, or a broken map comment
 * that costs nothing at runtime and quietly disables devtools for a year. */

let dist: string;
let cssHref: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "debian-tips-assets-"));
  copyPublic(dist);
  cssHref = writeHashedCss(dist, ".generated{color:red}");
});

afterAll(() => rmSync(dist, { recursive: true, force: true }));

const asset = (name: string): string => readFileSync(join(dist, "assets", name), "utf-8");

describe("the stylesheet", () => {
  it("is minified, and keeps the generated syntax-highlighting rules", () => {
    const css = asset(cssHref.replace("/assets/", ""));
    expect(css).toContain(".generated{color:red}");
    // The source is written one declaration per line with long explanatory comments; neither
    // survives minification, and both would show up here if it silently stopped running.
    expect(css).not.toContain("\n  --bg:");
    expect(css.length).toBeLessThan(readFileSync("styles/site.css", "utf-8").length);
  });

  it("points at a map that exists and carries the original source", () => {
    const name = cssHref.replace("/assets/", "");
    expect(asset(name)).toMatch(new RegExp(`/\\*# sourceMappingURL=${name}\\.map \\*/`));

    const map = JSON.parse(asset(`${name}.map`)) as { sources: string[]; sourcesContent: string[] };
    // Named for the source rather than the hashed output, which is what devtools shows.
    expect(map.sources).toEqual(["site.css"]);
    // Embedded, because styles/site.css is not itself served.
    expect(map.sourcesContent[0]).toContain("--bg:");
  });

  it("hashes the served bytes, so the URL moves when the output does", () => {
    const again = writeHashedCss(dist, ".generated{color:red}");
    expect(again).toBe(cssHref);
    expect(writeHashedCss(dist, ".generated{color:blue}")).not.toBe(cssHref);
  });
});

/* Every visitor pays for the stylesheet and the font on their first request, on whatever
 * connection they have. The site's claim is that it is fast, and nothing else here checks that:
 * one rule added to a long stylesheet is invisible in review, and a hundred of them is a
 * different site. These are ceilings with room to work in rather than targets, so crossing one
 * should be a decision somebody makes on purpose, in a diff that says so.
 *
 * The stylesheet is measured without the syntax-highlighting rules appended to it at build time,
 * because those are derived from the content rather than written. ADR-0018 has the reasoning and
 * the numbers as they stood when the budget was set. */
describe("the byte budget", () => {
  const gzipped = (source: string): number => gzipSync(Buffer.from(source), { level: 9 }).length;

  it("keeps the stylesheet within budget", () => {
    const css = readFileSync(join(dist, "assets", writeHashedCss(dist).replace("/assets/", "")), "utf-8");
    expect(css.length).toBeLessThan(30_000);
    expect(gzipped(css)).toBeLessThan(6_500);
  });

  it("ships one webfont, and only the Latin subset of it", () => {
    const fonts = readdirSync(join(dist, "assets")).filter((f) => f.endsWith(".woff2"));
    expect(fonts).toEqual([FONT_FILE]);
    expect(statSync(join(dist, "assets", FONT_FILE)).size).toBeLessThan(30_000);
  });
});

describe("public assets", () => {
  it("minifies the scripts and leaves everything else alone", () => {
    expect(asset("search.js")).toMatch(/\/\/# sourceMappingURL=search\.js\.map/);
    expect(readdirSync(join(dist, "assets"))).toContain("search.js.map");
    // Not a script, and not something to rewrite: it is the domain the site is served from.
    expect(readFileSync(join(dist, "CNAME"), "utf-8")).toContain("debian.tips");
  });
});
