// The search dialog, loaded on first open and not before.
//
// Fetched rather than inlined, which makes it the one exception in ADR-0013: it pulls in
// Pagefind's own JS and WASM bundle, which is much the heaviest thing the site can load, and a
// visitor who never searches should never pay for it. `openSearch` in src/client/interaction.ts
// imports it dynamically, so the cost lands on the first keystroke of the first search.
//
// Compiled to dist/assets/search.js by src/assets.ts, as a module rather than an IIFE, because
// that dynamic import needs something to import. Everything else under src/client/ is inlined
// into every page instead, and cannot import at all.
//
// This file stays small on purpose: it is the wrapper around Pagefind, not a search engine.

/** How many results the dialog shows. Anything past this is summarised rather than dropped
 *  silently; see runSearch. */
const SHOWN = 8;

/** Pagefind's bundle, whose shape is declared once in `src/client/ambient.d.ts`. Taken from the
 *  import rather than restated, so there is one hand-written description of a third-party API
 *  instead of two that can disagree. */
type Pagefind = typeof import("/pagefind/pagefind.js");

let dialog: HTMLDialogElement | null = null;
let input: HTMLInputElement | null = null;
let results: HTMLElement | null = null;
let status: HTMLElement | null = null;
let pagefind: Promise<Pagefind | null> | null = null;

const ESCAPE_HTML: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_HTML[c] ?? c);
}

export function openSearch(): void {
  if (!dialog) {
    dialog = document.getElementById("search-dialog") as HTMLDialogElement | null;
    input = document.getElementById("search-input") as HTMLInputElement | null;
    results = document.getElementById("search-results");
    status = document.getElementById("search-status");
    // Every one of these is written by src/templates/layout.ts into every page, so a miss means
    // the markup and this file have gone out of step. Returning is the whole handling: the
    // trigger does nothing, which is better than a half-wired dialog that opens over the page
    // and cannot be closed.
    if (!dialog || !input || !results || !status) return;

    const openDialog = dialog;
    openDialog.addEventListener("click", (ev) => {
      if (ev.target === openDialog) openDialog.close();
    });
    openDialog.querySelector("[data-search-close]")?.addEventListener("click", () => openDialog.close());
    input.addEventListener("input", () => void runSearch());
  } else if (dialog.open) {
    return;
  }
  if (!input || !results || !status) return;

  dialog.showModal();
  input.value = "";
  results.innerHTML = "";
  status.textContent = "";
  input.focus();

  if (!pagefind) {
    // The bundle is written into dist/ by the indexer, so it is absent from any build that did
    // not run Pagefind. `npm run dev` does run it on every rebuild, which is what keeps search
    // working locally; a bare `tsx src/build.ts` does not. Caught here so that case is a sentence
    // in the dialog rather than an unhandled rejection and a control that silently does nothing.
    pagefind = import("/pagefind/pagefind.js").then((m) => m.init().then(() => m)).catch(() => null);
  }
}

async function runSearch(): Promise<void> {
  if (!input || !results || !status) return;
  const query = input.value;
  if (!query) {
    results.innerHTML = "";
    status.textContent = "";
    return;
  }
  const pf = await pagefind;
  if (!pf) {
    results.innerHTML =
      '<li class="search-empty">Search index unavailable. Run <code>npm run build</code> to generate it.</li>';
    return;
  }
  const search = await pf.debouncedSearch(query);
  if (!search || query !== input.value) return;
  const entries = await Promise.all(search.results.slice(0, SHOWN).map((r) => r.data()));
  if (query !== input.value) return;

  if (!entries.length) {
    results.innerHTML = '<li class="search-empty">No results found.</li>';
    status.textContent = "No results found.";
    return;
  }

  // `excerpt` is inserted as markup on purpose: Pagefind escapes the page text it came from and
  // wraps the matched words in <mark>, which is the highlighting. `title` and `url` are escaped,
  // even though Pagefind derives both from this site's own build: an unescaped value in an
  // attribute is the kind of thing that stops being safe when the source of it changes.
  const items = entries.map(
    (e) =>
      `<li><a href="${escapeHtml(e.url)}"><span class="search-result-title">${escapeHtml(e.meta.title)}</span><span class="search-result-excerpt">${e.excerpt}</span></a></li>`,
  );
  // A hard cap with nothing said about it reads as "that's all there is". As the site grows,
  // most searches will have more behind them than the first handful shown.
  if (search.results.length > entries.length) {
    items.push(
      `<li class="search-more">Showing ${entries.length} of ${search.results.length} matches. Keep typing to narrow it down.</li>`,
    );
  }
  results.innerHTML = items.join("");
  status.textContent = `${search.results.length} result${search.results.length === 1 ? "" : "s"}.`;
}
