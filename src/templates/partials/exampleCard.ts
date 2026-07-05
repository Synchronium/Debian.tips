import { html, raw } from "../../html.js";
import { highlightCode } from "../../content/markdown.js";
import type { Example } from "../../content/schema.js";

function withAriaLabel(preHtml: string, label: string): string {
  return preHtml.replace(/^<pre /, `<pre aria-label="${label}" `);
}

export async function exampleCard(sectionSlug: string, index: number, example: Example): Promise<string> {
  const id = `${sectionSlug}-${index}`;
  const codeHtml = withAriaLabel(await highlightCode(example.code, "bash"), "command");
  const outputHtml = example.output
    ? withAriaLabel(await highlightCode(example.output, "plaintext"), "output")
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
