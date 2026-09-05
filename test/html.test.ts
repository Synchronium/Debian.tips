import { describe, expect, it } from "vitest";
import { EMPTY_HTML, escapeHtml, html, joinHtml, raw } from "../src/html.js";

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
    expect(html`<h1>${title}</h1>`.value).toBe("<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>");
  });

  it("does not escape values wrapped in raw()", () => {
    const trusted = "<em>hi</em>";
    expect(html`<p>${raw(trusted)}</p>`.value).toBe("<p><em>hi</em></p>");
  });

  it("joins arrays with no separator", () => {
    const items = ["a", "b", "c"];
    expect(html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`.value).toBe(
      "<ul><li>a</li><li>b</li><li>c</li></ul>",
    );
  });

  /* The escaping contract, which is two rules that have to hold at once: a nested template
   * composes as markup with no wrapper, and the text inside it is still escaped on the way in.
   * Composing without escaping would splice a reader's text into a page as markup; escaping
   * without composing would render the site's own tags as visible angle brackets. */
  it("composes a nested template as markup while still escaping its values", () => {
    const items = ["a<b"];
    expect(html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`.value).toBe("<ul><li>a&lt;b</li></ul>");
  });

  it("escapes a plain string that merely looks like markup", () => {
    expect(html`<ul>${"<li>a</li>"}</ul>`.value).toBe("<ul>&lt;li&gt;a&lt;/li&gt;</ul>");
  });

  it("renders null, undefined, and false as empty string", () => {
    expect(html`<span>${null}${undefined}${false}</span>`.value).toBe("<span></span>");
  });

  it("renders 0 and empty string as themselves, not as falsy-empty", () => {
    expect(html`${0}`.value).toBe("0");
    expect(html`${""}`.value).toBe("");
  });

  it("renders EMPTY_HTML as nothing", () => {
    expect(html`<p>${EMPTY_HTML}</p>`.value).toBe("<p></p>");
  });
});

describe("joinHtml", () => {
  it("puts the separator between fragments and keeps their markup", () => {
    const parts = [html`<b>${"a<b"}</b>`, html`<i>c</i>`];
    expect(joinHtml(parts, ", ").value).toBe("<b>a&lt;b</b>, <i>c</i>");
  });

  it("returns something the template will not escape again", () => {
    const joined = joinHtml([html`<b>x</b>`, html`<b>y</b>`], " and ");
    expect(html`<p>${joined}</p>`.value).toBe("<p><b>x</b> and <b>y</b></p>");
  });

  it("renders an empty list as nothing", () => {
    expect(joinHtml([], ", ").value).toBe("");
  });
});
