import { html, type Raw } from "../../html.js";

/** Where `/about/` explains figures that belong to the machine, and the examples that stand in
 *  for them. The id is the one `rehype-slug` gives that page's heading, so renaming the heading
 *  means changing this, and linkcheck reports the anchor if the two disagree. */
const ABOUT_HOST_FIGURES = "/about/#figures-that-belong-to-the-machine";

/** The sentence above a proof example (ADR-0029), on a command page and on a prose page alike.
 *
 *  A proof example is a command a reader would rarely type, on the page only so that the replay
 *  can check what the page says about an example whose own output describes the host. Unmarked,
 *  it reads as a command worth learning, and a reader who copies it has been taught something
 *  the page never meant to teach. So this says why the example is there before the reader gets
 *  to its description.
 *
 *  `exempt` names that other example as the reader sees it: a link to it on a command page, and
 *  "The command above" on a prose page, where the loader requires it to be the output block
 *  immediately before. Written once here so both kinds of page say the same thing. */
export function proofNote(exempt: Raw): Raw {
  return html`<p class="proof-note"><strong>Why this example is here:</strong> ${exempt} prints
figures that belong to the machine it runs on, so its output is different everywhere and cannot be
checked the way the rest of the examples on this site are. This command is here to check what the
page says about that output instead. It works the claim out and prints the answer, and
<a href="${ABOUT_HOST_FIGURES}">that answer is re-run on every change</a>. You are unlikely to need
it yourself.</p>`;
}
