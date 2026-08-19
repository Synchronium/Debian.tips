// Lazy-loaded on first search-dialog open (see src/client/interaction.js).
// Pulls in Pagefind's own JS/WASM bundle, which is the actually heavy part —
// this file itself stays tiny so the always-loaded inline script doesn't.

/** How many results the dialog shows. Anything past this is summarised rather than dropped
 *  silently — see runSearch. */
const SHOWN = 8;

let dialog, input, results, status, pagefind;

const ESCAPE_HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_HTML[c]);
}

export function openSearch() {
  if (!dialog) {
    dialog = document.getElementById("search-dialog");
    input = document.getElementById("search-input");
    results = document.getElementById("search-results");
    status = document.getElementById("search-status");
    dialog.addEventListener("click", (ev) => {
      if (ev.target === dialog) dialog.close();
    });
    const closeBtn = dialog.querySelector("[data-search-close]");
    closeBtn.addEventListener("click", () => dialog.close());
    input.addEventListener("input", runSearch);
  } else if (dialog.open) {
    return;
  }

  dialog.showModal();
  input.value = "";
  results.innerHTML = "";
  status.textContent = "";
  input.focus();

  if (!pagefind) {
    // `npm run dev` rebuilds via src/build.ts only, which doesn't run Pagefind —
    // so this import 404s in local dev. Fail with a visible explanation rather
    // than an unhandled rejection and a dialog that silently does nothing.
    pagefind = import("/pagefind/pagefind.js")
      .then((m) => m.init().then(() => m))
      .catch(() => null);
  }
}

async function runSearch() {
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
  // debouncedSearch returns null when a newer keystroke superseded this call.
  if (!search || query !== input.value) return;
  const entries = await Promise.all(search.results.slice(0, SHOWN).map((r) => r.data()));
  if (query !== input.value) return;

  if (!entries.length) {
    results.innerHTML = '<li class="search-empty">No results found.</li>';
    status.textContent = "No results found.";
    return;
  }

  // `excerpt` is inserted as markup on purpose: Pagefind escapes the page text it came from and
  // wraps the matched words in <mark>, which is the highlighting. Every other field is escaped.
  const items = entries.map(
    (e) =>
      `<li><a href="${e.url}"><span class="search-result-title">${escapeHtml(e.meta.title)}</span><span class="search-result-excerpt">${e.excerpt}</span></a></li>`,
  );
  // A hard cap with nothing said about it reads as "that's all there is". As the site grows,
  // most searches will have more behind them than the first handful shown.
  if (search.results.length > entries.length) {
    items.push(
      `<li class="search-more">Showing ${entries.length} of ${search.results.length} matches — keep typing to narrow it down.</li>`,
    );
  }
  results.innerHTML = items.join("");
  status.textContent = `${search.results.length} result${search.results.length === 1 ? "" : "s"}.`;
}
