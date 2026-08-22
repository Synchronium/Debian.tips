import { html, raw } from "../../html.js";
import { blobUrl } from "../../config.js";
import type { PageSources } from "../../content/sourcePaths.js";
import type { PageChecks } from "../../content/pageChecks.js";

/** Where a reader finds the reason an output is exempt.
 *
 *  A command page names each exemption in `scripts/fixtures/<slug>.skip`, which is listed among
 *  the files above. A prose page writes the reason inline, as an HTML comment above the block,
 *  which the Markdown pipeline strips, so it is visible only in the page source, also linked
 *  above. Pointing a reader at the wrong one of those sends them after a file that does not
 *  exist, on the block whose whole job is to make the claim checkable. */
function exemptionsAreIn(sources: PageSources): string {
  return sources.hasSkipFile ? "the skip file above" : "the page source above";
}

/** What the replay command will actually check here, as a sentence.
 *
 *  Every clause is conditional, so the common page (everything compared exactly, nothing
 *  exempt) reads as one short claim rather than a row of zeroes. The figures come from
 *  `src/content/pageChecks.ts`, which is also what the harness partitions on and what `/about/`
 *  sums, so this cannot advertise a number the command contradicts.
 *
 *  The zero-checked case is real and is the interesting one: a page can opt into the replay, be
 *  run by it, and have every one of its blocks exempt. `/about/` deliberately leaves such a page
 *  out of both its counters, so this is the only place that says so. */
function checksSentence(checks: PageChecks, sources: PageSources): string {
  const where = exemptionsAreIn(sources);

  const exemptClause =
    checks.exempt === 0
      ? ""
      : html` ${checks.exempt} more ${checks.exempt === 1 ? "is" : "are"} exempt; ${where} says how
${checks.exempt === 1 ? "it was" : "each was"} checked instead.`;

  if (checks.checked === 0) {
    if (checks.exempt === 0) return "";
    return html`<p class="page-checks">
This page documents ${checks.exempt === 1 ? "one output" : `${checks.exempt} outputs`}, and the
batch cannot run ${checks.exempt === 1 ? "it" : "any of them"}. How
${checks.exempt === 1 ? "it was" : "each was"} checked instead is recorded in ${where}, and the
command reports exactly that.
</p>`;
  }

  const split =
    checks.byShape === 0
      ? html`, all compared exactly`
      : html`: ${checks.checked - checks.byShape} exactly and ${checks.byShape}
<a href="/about/#output-that-cannot-be-identical">by shape</a>`;

  return html`<p class="page-checks">
Checks ${checks.checked} ${checks.checked === 1 ? "output" : "outputs"}${raw(split)}.${raw(exemptClause)}
</p>`;
}

/** The foot of every page: the files that produced it, what the replay checks here, and the one
 *  command that re-runs it in a disposable container.
 *
 *  The copy button needs no wiring of its own: `src/client/interaction.ts` delegates from
 *  `[data-copy]` on the document, so this gets the same behaviour as every example's Copy.
 *
 *  A page with no setup script is a real state and gets a different sentence rather than a
 *  hidden block: `npm run replay -- <slug>` would report it as unverified, and printing a
 *  command that does not do what the surrounding text claims is worse than saying so. */
export function sourceLinks(slug: string, sources: PageSources, checks: PageChecks): string {
  const items = sources.files.map((file) =>
    raw(html`<li><a href="${blobUrl(file.path)}"><code>${file.path}</code></a> — ${file.label}</li>`),
  );

  const replayCommand = `npm run replay -- ${slug}`;

  // `data-pagefind-ignore`: the whole of <main> is the search body, and this block is the same
  // paragraph on every page. Indexed, it would make "container", "repository" and "replay" match
  // every page on the site equally, which is worse than not matching at all.
  return html`<aside class="page-sources" aria-labelledby="page-sources-heading" data-pagefind-ignore>
<h2 id="page-sources-heading">Check this page yourself</h2>
<p>
Nothing on this page was written from memory. Every output was captured from a real run, and is
re-run on every change (<a href="/about/">how that works</a>). These are the files behind it:
</p>
<ul class="source-files">${items}</ul>
${
  sources.replayable
    ? raw(html`<p>
Clone the repository and re-run every example on this page in a throwaway container. It needs
Docker and takes about a minute:
</p>
<div class="source-replay">
<pre><code>${replayCommand}</code></pre>
<button class="copy" type="button" aria-label="Copy command" data-copy="${replayCommand}">Copy</button>
</div>
${raw(checksSentence(checks, sources))}`)
    : raw(html`<p>
This page has no setup script yet, so nothing re-runs its examples: they were checked by hand
when it was written and nothing has checked them since. Adding
<code>scripts/fixtures/${slug}.sh</code> is what would put it in the batch.
</p>`)
}
</aside>`;
}
