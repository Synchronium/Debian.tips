// Lazy-loaded on first search-dialog open (see layout.ts INTERACTION_SCRIPT).
// Pulls in Pagefind's own JS/WASM bundle, which is the actually heavy part —
// this file itself stays tiny so the always-loaded inline script doesn't.

let dialog, input, results, pagefind;

const ESCAPE_HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_HTML[c]);
}

export function openSearch() {
  if (!dialog) {
    dialog = document.getElementById("search-dialog");
    input = document.getElementById("search-input");
    results = document.getElementById("search-results");
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
  input.focus();

  if (!pagefind) {
    pagefind = import("/pagefind/pagefind.js").then((m) => m.init().then(() => m));
  }
}

async function runSearch() {
  const query = input.value;
  if (!query) {
    results.innerHTML = "";
    return;
  }
  const pf = await pagefind;
  const search = await pf.debouncedSearch(query);
  // debouncedSearch returns null when a newer keystroke superseded this call.
  if (!search || query !== input.value) return;
  const entries = await Promise.all(search.results.slice(0, 8).map((r) => r.data()));
  if (query !== input.value) return;

  results.innerHTML = entries.length
    ? entries
        .map(
          (e) =>
            `<li><a href="${e.url}"><span class="search-result-title">${escapeHtml(e.meta.title)}</span><span class="search-result-excerpt">${e.excerpt}</span></a></li>`,
        )
        .join("")
    : '<li class="search-empty">No results found.</li>';
}
