import { html, raw } from "../../html.js";
import { blobUrl } from "../../config.js";
import type { PageSources } from "../../content/sourcePaths.js";

/** The foot of every page: the files that produced it, and the one command that re-runs its
 *  examples in a disposable container.
 *
 *  The copy button needs no wiring of its own — `src/client/interaction.ts` delegates from
 *  `[data-copy]` on the document, so this gets the same behaviour as every example's Copy.
 *
 *  A page with no setup script is a real state and gets a different sentence rather than a
 *  hidden block: `npm run replay -- <slug>` would report it as unverified, and printing a
 *  command that does not do what the surrounding text claims is worse than saying so. */
export function sourceLinks(slug: string, sources: PageSources): string {
  const items = sources.files.map((file) =>
    raw(html`<li><a href="${blobUrl(file.path)}"><code>${file.path}</code></a> — ${file.label}</li>`),
  );

  const replay = `npm run replay -- ${slug}`;

  // `data-pagefind-ignore`: the whole of <main> is the search body, and this block is the same
  // paragraph on all 50 pages. Indexed, it would make "container", "repository" and "replay"
  // match every page on the site equally, which is worse than not matching at all.
  return html`<aside class="page-sources" aria-labelledby="page-sources-heading" data-pagefind-ignore>
<h2 id="page-sources-heading">Check this page yourself</h2>
<p>
Nothing on this page was written from memory. Every output was captured from a real run, and is
re-run on every change — <a href="/about/">how that works</a>. These are the files behind it:
</p>
<ul class="source-files">${items}</ul>
${
  sources.replayable
    ? raw(html`<p>
Clone the repository and re-run every example on this page in a throwaway container. It needs
Docker and takes about a minute:
</p>
<div class="source-replay">
<pre><code>${replay}</code></pre>
<button class="copy" type="button" aria-label="Copy command" data-copy="${replay}">Copy</button>
</div>`)
    : raw(html`<p>
This page has no setup script yet, so nothing re-runs its examples: they were checked by hand
when it was written and nothing has checked them since. Adding
<code>scripts/fixtures/${slug}.sh</code> is what would put it in the batch.
</p>`)
}
</aside>`;
}
