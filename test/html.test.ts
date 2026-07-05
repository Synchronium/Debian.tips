import { describe, expect, it } from "vitest";
import { escapeHtml, html, raw } from "../src/html.js";

const nest = (s: string) => raw(html`<li>${s}</li>`);

describe("escapeHtml", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("grep -r pattern .")).toBe("grep -r pattern .");
  });
});

describe("html tagged template", () => {
  it("escapes interpolated values by default", () => {
    const title = `<script>alert(1)</script>`;
    expect(html`<h1>${title}</h1>`).toBe("<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>");
  });

  it("does not escape values wrapped in raw()", () => {
    const trusted = "<em>hi</em>";
    expect(html`<p>${raw(trusted)}</p>`).toBe("<p><em>hi</em></p>");
  });

  it("joins arrays with no separator", () => {
    const items = ["a", "b", "c"];
    expect(html`<ul>${items.map((i) => raw(html`<li>${i}</li>`))}</ul>`).toBe(
      "<ul><li>a</li><li>b</li><li>c</li></ul>",
    );
  });

  it("bare (unwrapped) nested html() output gets double-escaped, by design", () => {
    // Nested html`` calls return plain strings; authors must wrap them in
    // raw() to splice them in as markup (see PLAN-BUILD.md §4). This test
    // documents that omitting raw() is caught, not silently accepted.
    const items = ["a<b"];
    const nestedWithoutRaw = html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
    expect(nestedWithoutRaw).toBe("<ul>&lt;li&gt;a&amp;lt;b&lt;/li&gt;</ul>");
    expect(html`<ul>${items.map(nest)}</ul>`).toBe("<ul><li>a&lt;b</li></ul>");
  });

  it("renders null, undefined, and false as empty string", () => {
    expect(html`<span>${null}${undefined}${false}</span>`).toBe("<span></span>");
  });

  it("renders 0 and empty string as themselves, not as falsy-empty", () => {
    expect(html`${0}`).toBe("0");
    expect(html`${""}`).toBe("");
  });
});
