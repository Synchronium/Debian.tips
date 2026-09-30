import { EMPTY_HTML, html, raw, type Raw } from "../../html.js";
import { proofNote } from "./proofNote.js";
import { highlightCode, renderInline } from "../../content/markdown.js";
import type { Example } from "../../content/schema.js";

function injectAttr(preHtml: string, attr: string): string {
  return preHtml.replace(/^<pre /, `<pre ${attr} `);
}

/** Single-line, unpiped commands get the `$ ` prompt decoration, drawn purely in
 * CSS so it never lands in the clipboard; multi-line or piped commands don't get
 * it, since a leading prompt reads as noise once the command wraps. */
function isPromptable(code: string): boolean {
  return !code.includes("\n") && !code.includes("|");
}

/** An example's anchor on its page, which is also what `proves:` links to. */
export function exampleId(sectionSlug: string, index: number): string {
  return `${sectionSlug}-${index}`;
}

/** `proven` is the anchor of the example this one `proves:`, and is required when it names one.
 *  Resolved by the page, because an example cannot see its siblings. */
export async function exampleCard(
  sectionSlug: string,
  index: number,
  example: Example,
  proven?: string,
): Promise<Raw> {
  const id = exampleId(sectionSlug, index);

  let codeHtml = injectAttr(await highlightCode(example.code, "bash"), 'aria-label="command"');
  if (isPromptable(example.code)) codeHtml = injectAttr(codeHtml, 'data-prompt="1"');

  // `!== undefined`, not truthiness: the schema permits an empty `output:`, and the replay and
  // the expand-all count both treat one as a documented output. Rendering no block for it would
  // put the page's own figures out by one against what it shows.
  const outputHtml =
    example.output === undefined
      ? null
      : injectAttr(await highlightCode(example.output, "plaintext"), 'aria-label="output"');

  const descHtml = await renderInline(example.description, `example "${example.title}"`);
  // A volatile example's output is real, but the reader's will differ. The note says how,
  // so they can tell an expected difference from a broken command.
  const volatileHtml = example.volatile
    ? await renderInline(example.volatile, `example "${example.title}" volatile note`)
    : "";

  // The loader has refused a `proves:` naming no example, so a missing anchor is a caller that
  // forgot to pass it. Rendering the card unmarked would hide the note from the reader and fail
  // nothing.
  const isProof = example.proves !== undefined;
  if (isProof && proven === undefined) {
    throw new Error(`example "${example.title}" proves "${example.proves}", but no anchor was passed for it`);
  }
  const proofHtml = isProof
    ? proofNote(html`The command in <a href="#${proven}">“${example.proves}”</a>`)
    : EMPTY_HTML;
  const classes = ["example", example.danger ? "example-danger" : "", isProof ? "example-proof" : ""]
    .filter((name) => name !== "")
    .join(" ");

  return html`<article class="${classes}" id="${id}">
<h3 class="example-title"><a href="#${id}">${example.title}</a></h3>
<div class="example-code">
${raw(codeHtml)}
<button class="copy" type="button" aria-label="Copy command" data-copy="${example.code}">Copy</button>
</div>
${proofHtml}
<p class="example-desc">${raw(descHtml)}</p>
${
  outputHtml
    ? html`<details class="example-output"><summary>Show output</summary>
${volatileHtml ? html`<p class="output-varies"><strong>Your output will differ:</strong> ${raw(volatileHtml)}</p>` : ""}
${raw(outputHtml)}</details>`
    : ""
}
</article>`;
}
