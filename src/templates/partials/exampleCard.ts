import { html, raw } from "../../html.js";
import { highlightCode } from "../../content/markdown.js";
import type { Example } from "../../content/schema.js";

function injectAttr(preHtml: string, attr: string): string {
  return preHtml.replace(/^<pre /, `<pre ${attr} `);
}

/** Single-line, unpiped commands get the `$ ` prompt decoration (CSS-only, see
 * PLAN-DESIGN.md §4.1); multi-line or piped commands don't, so copying stays clean either way. */
function isPromptable(code: string): boolean {
  return !code.includes("\n") && !code.includes("|");
}

export async function exampleCard(sectionSlug: string, index: number, example: Example): Promise<string> {
  const id = `${sectionSlug}-${index}`;

  let codeHtml = injectAttr(await highlightCode(example.code, "bash"), 'aria-label="command"');
  if (isPromptable(example.code)) codeHtml = injectAttr(codeHtml, 'data-prompt="1"');

  const outputHtml = example.output
    ? injectAttr(await highlightCode(example.output, "plaintext"), 'aria-label="output"')
    : null;

  return html`<article class="example${example.danger ? " example-danger" : ""}" id="${id}">
<h3 class="example-title"><a href="#${id}">${example.title}</a></h3>
<div class="example-code">
${raw(codeHtml)}
<button class="copy" type="button" aria-label="Copy command" data-copy="${example.code}">Copy</button>
</div>
<p class="example-desc">${example.description}</p>
${outputHtml ? raw(html`<details class="example-output"><summary>Show output</summary>${raw(outputHtml)}</details>`) : ""}
</article>`;
}
