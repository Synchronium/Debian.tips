import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copyPublic, writeHashedCss } from "../src/assets.js";

/* The stylesheet and the static scripts are minified with a source map beside them. None of it
 * is visible in the rendered HTML — the page links a hashed filename either way — so a break
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

describe("public assets", () => {
  it("minifies the scripts and leaves everything else alone", () => {
    expect(asset("search.js")).toMatch(/\/\/# sourceMappingURL=search\.js\.map/);
    expect(readdirSync(join(dist, "assets"))).toContain("search.js.map");
    // Not a script, and not something to rewrite: it is the domain the site is served from.
    expect(readFileSync(join(dist, "CNAME"), "utf-8")).toContain("debian.tips");
  });
});
