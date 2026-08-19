import { beforeEach, describe, expect, it } from "vitest";
import { extractShikiStyles, resetShikiStyles, shikiStyleCss } from "../src/content/shikiStyles.js";

/* Lifting Shiki's inline styles into classes rewrites the markup of every code block on the
 * site, and the stylesheet it produces is content-hashed — so the two things that matter are
 * that no colour is lost on the way, and that the same content always produces the same
 * stylesheet. */

beforeEach(resetShikiStyles);

const SPAN = '<span style="color:#005CC5;--shiki-dark:#79C0FF">wc</span>';

describe("extractShikiStyles", () => {
  it("replaces an inline style with a class and records the declarations", () => {
    const html = extractShikiStyles(SPAN);
    expect(html).toMatch(/^<span class="s[0-9a-f]{6}">wc<\/span>$/);
    expect(html).not.toContain("style=");
    expect(shikiStyleCss()).toBe(
      `.${/class="(s[0-9a-f]{6})"/.exec(html)![1]}{color:#005CC5;--shiki-dark:#79C0FF}`,
    );
  });

  it("gives one class to every occurrence of the same declarations", () => {
    const html = extractShikiStyles(`${SPAN}${SPAN}${SPAN}`);
    const classes = [...html.matchAll(/class="(s[0-9a-f]{6})"/g)].map((match) => match[1]);
    expect(new Set(classes).size).toBe(1);
    expect(shikiStyleCss().split("\n")).toHaveLength(1);
  });

  it("appends to the class a <pre> already has, rather than adding a second attribute", () => {
    const pre =
      '<pre class="shiki shiki-themes github-light github-dark-default" style="background-color:#fff;--shiki-dark-bg:#0d1117;color:#24292e;--shiki-dark:#e6edf3" tabindex="0">';
    const html = extractShikiStyles(pre);
    expect([...html.matchAll(/class="/g)]).toHaveLength(1);
    expect(html).toMatch(/class="shiki shiki-themes github-light github-dark-default s[0-9a-f]{6}"/);
    expect(html).toContain('tabindex="0"');
  });

  it("leaves a span Shiki did not style alone", () => {
    expect(extractShikiStyles('<span class="line"><span>plain</span></span>')).toBe(
      '<span class="line"><span>plain</span></span>',
    );
  });

  it("produces the same stylesheet whatever order the pages were rendered in", () => {
    // The stylesheet is content-hashed. A registry emitted in insertion order would change its
    // hash whenever the build happened to render pages in a different order, busting every
    // reader's cache for no reason.
    const a = '<span style="color:#111111;--shiki-dark:#aaaaaa">a</span>';
    const b = '<span style="color:#222222;--shiki-dark:#bbbbbb">b</span>';

    extractShikiStyles(`${a}${b}`);
    const forwards = shikiStyleCss();
    resetShikiStyles();
    extractShikiStyles(`${b}${a}`);
    expect(shikiStyleCss()).toBe(forwards);
  });

  it("forgets everything on reset, so a long-lived dev server cannot accumulate dead colours", () => {
    extractShikiStyles(SPAN);
    expect(shikiStyleCss()).not.toBe("");
    resetShikiStyles();
    expect(shikiStyleCss()).toBe("");
  });
});
